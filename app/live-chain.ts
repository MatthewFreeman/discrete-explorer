"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import emissionData from "@/data/emission-decade.json";
import { isRpcSnapshotFresh, requireRpcQuorum } from "@/app/live-chain-quorum";

const RPC_ENDPOINTS = [
  "https://seed1.discrete.cash:9332",
  "https://seed2.discrete.cash:9332",
] as const;
const REQUEST_TIMEOUT_MS = 8_000;
const REFRESH_INTERVAL_MS = 60_000;
const SNAPSHOT_MAX_AGE_MS = REFRESH_INTERVAL_MS + REQUEST_TIMEOUT_MS;
const atomsPerXds = BigInt(100);

type NodeInfo = {
  already_generated_coins: string;
  deep_reorg_protection?: boolean;
  finality_fork_warning?: boolean;
  finalized_height?: number;
  height: number;
  next_reward: number;
  status: string;
  top_block_hash?: string;
};

type BlockHeaderResponse = {
  result?: {
    block_header?: {
      hash?: string;
      height: number;
      timestamp: number;
    };
    status?: string;
  };
};

export type LiveChainSnapshot = {
  chainHeight: number;
  tipHeight: number;
  tipHash: string;
  tipTimestamp: string;
  generatedSupplyXds: string;
  minerIssuanceXds: string;
  treasuryUnlockedXds: string;
  minedPlusScheduledUnlockedXds: string;
  nextRewardXds: string;
  finalizedHeight: number | null;
  nodeWarning: boolean;
  source: string;
  fetchedAt: string;
  withinModel: boolean;
  yearIndex: number | null;
  monthIndex: number | null;
};

export type LiveChainState = {
  status: "loading" | "online" | "error";
  snapshot: LiveChainSnapshot | null;
  refreshing: boolean;
  error: string | null;
};

const parseXdsAtoms = (value: string | number) => {
  const normalized = String(value).trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
    throw new Error("RPC returned an invalid XDS amount");
  }
  const [whole, fraction = ""] = normalized.split(".");
  return BigInt(whole) * atomsPerXds + BigInt(fraction.padEnd(2, "0"));
};

const formatAtoms = (atoms: bigint) => {
  if (atoms < 0) throw new Error("RPC generated supply is below the genesis reserve");
  return `${atoms / atomsPerXds}.${(atoms % atomsPerXds).toString().padStart(2, "0")}`;
};

const fetchJson = async <T>(url: string, init?: RequestInit) => {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`RPC returned HTTP ${response.status}`);
  return (await response.json()) as T;
};

const fetchCandidate = async (source: string): Promise<LiveChainSnapshot> => {
  const info = await fetchJson<NodeInfo>(`${source}/getinfo`);
  const chainHeight = Number(info.height);
  if (
    info.status !== "OK" ||
    !Number.isSafeInteger(chainHeight) ||
    chainHeight < 2 ||
    !Number.isFinite(Number(info.next_reward))
  ) {
    throw new Error("RPC returned invalid chain information");
  }

  const tipHeight = chainHeight - 1;
  const headerPayload = await fetchJson<BlockHeaderResponse>(`${source}/json_rpc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "xds_emission_live_tip",
      method: "getblockheaderbyheight",
      params: { height: tipHeight },
    }),
  });
  const header = headerPayload.result?.block_header;
  const headerHash = header?.hash?.toLowerCase() ?? "";
  const infoHash = info.top_block_hash?.toLowerCase() ?? "";
  if (
    headerPayload.result?.status !== "OK" ||
    !header ||
    header.height !== tipHeight ||
    !Number.isSafeInteger(header.timestamp) ||
    header.timestamp <= 0 ||
    !/^[0-9a-f]{64}$/.test(headerHash) ||
    !/^[0-9a-f]{64}$/.test(infoHash) ||
    headerHash !== infoHash ||
    !Number.isSafeInteger(Number(info.next_reward)) ||
    Number(info.next_reward) < 0
  ) {
    throw new Error("RPC tip header does not match chain height");
  }

  const generatedAtoms = parseXdsAtoms(info.already_generated_coins);
  const reserveAtoms = parseXdsAtoms(emissionData.meta.genesisReserveXds);
  const minerIssuanceAtoms = generatedAtoms - reserveAtoms;
  const reserve = emissionData.meta.treasuryReserve;
  const unlockedBatches = Math.min(
    reserve.batches,
    Math.floor(tipHeight / reserve.unlockStepBlocks) + 1,
  );
  const treasuryUnlockedAtoms =
    BigInt(unlockedBatches) * parseXdsAtoms(reserve.batchXds);
  const globalMonthIndex = Math.floor(
    (tipHeight - 1) / emissionData.meta.blocksPerProtocolMonth,
  );
  const withinModel =
    tipHeight >= 1 && tipHeight <= emissionData.meta.modeledThroughBlock;

  return {
    chainHeight,
    tipHeight,
    tipHash: headerHash,
    tipTimestamp: new Date(header.timestamp * 1_000).toISOString(),
    generatedSupplyXds: formatAtoms(generatedAtoms),
    minerIssuanceXds: formatAtoms(minerIssuanceAtoms),
    treasuryUnlockedXds: formatAtoms(treasuryUnlockedAtoms),
    minedPlusScheduledUnlockedXds: formatAtoms(
      minerIssuanceAtoms + treasuryUnlockedAtoms,
    ),
    nextRewardXds: formatAtoms(BigInt(Math.trunc(Number(info.next_reward)))),
    finalizedHeight: Number.isSafeInteger(Number(info.finalized_height))
      ? Number(info.finalized_height)
      : null,
    nodeWarning:
      info.finality_fork_warning === true || info.deep_reorg_protection === false,
    source,
    fetchedAt: new Date().toISOString(),
    withinModel,
    yearIndex: withinModel ? Math.floor(globalMonthIndex / 12) : null,
    monthIndex: withinModel ? globalMonthIndex % 12 : null,
  };
};

export const loadLiveChainSnapshot = async () => {
  const settled = await Promise.allSettled(
    RPC_ENDPOINTS.map((endpoint) => fetchCandidate(endpoint)),
  );
  const candidates = settled.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : [],
  );
  return requireRpcQuorum(candidates, RPC_ENDPOINTS.length);
};

export function useLiveChain() {
  const mounted = useRef(true);
  const [state, setState] = useState<LiveChainState>({
    status: "loading",
    snapshot: null,
    refreshing: false,
    error: null,
  });
  const snapshotFetchedAt = state.snapshot?.fetchedAt;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    setState((current) => {
      const snapshot =
        current.snapshot &&
        isRpcSnapshotFresh(current.snapshot.fetchedAt, Date.now(), SNAPSHOT_MAX_AGE_MS)
          ? current.snapshot
          : null;
      return {
        status: snapshot ? "online" : "loading",
        snapshot,
        refreshing: true,
        error: null,
      };
    });
    try {
      const snapshot = await loadLiveChainSnapshot();
      if (!mounted.current) return;
      setState({ status: "online", snapshot, refreshing: false, error: null });
    } catch (error) {
      if (!mounted.current) return;
      setState(() => ({
        status: "error",
        snapshot: null,
        refreshing: false,
        error: error instanceof Error ? error.message : "Live RPC request failed",
      }));
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), REFRESH_INTERVAL_MS);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [refresh]);

  useEffect(() => {
    if (!snapshotFetchedAt) return;
    const fetchedAtMs = Date.parse(snapshotFetchedAt);
    const remainingMs = Number.isFinite(fetchedAtMs)
      ? Math.max(0, SNAPSHOT_MAX_AGE_MS - (Date.now() - fetchedAtMs))
      : 0;
    const expiryTimer = window.setTimeout(() => {
      setState((current) =>
        current.snapshot?.fetchedAt === snapshotFetchedAt
          ? {
              status: current.refreshing ? "loading" : "error",
              snapshot: null,
              refreshing: current.refreshing,
              error: current.refreshing ? null : "Live RPC snapshot expired",
            }
          : current,
      );
    }, remainingMs);
    return () => window.clearTimeout(expiryTimer);
  }, [snapshotFetchedAt]);

  return { ...state, refresh };
}

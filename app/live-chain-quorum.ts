export type RpcQuorumCandidate = {
  chainHeight: number;
  tipHeight: number;
  tipHash: string;
  tipTimestamp: string;
  generatedSupplyXds: string;
  nextRewardXds: string;
  nodeWarning: boolean;
};

const agreementFields = [
  "chainHeight",
  "tipHeight",
  "tipHash",
  "tipTimestamp",
  "generatedSupplyXds",
  "nextRewardXds",
] as const satisfies readonly (keyof RpcQuorumCandidate)[];

export function requireRpcQuorum<T extends RpcQuorumCandidate>(
  candidates: readonly T[],
  expectedCount: number,
): T {
  if (candidates.length !== expectedCount) {
    throw new Error("Discrete RPC quorum is unavailable");
  }

  const reference = candidates[0];
  if (!reference) throw new Error("Discrete RPC quorum is unavailable");

  for (const candidate of candidates.slice(1)) {
    if (agreementFields.some((field) => candidate[field] !== reference[field])) {
      throw new Error("Discrete RPC nodes disagree on the chain tip");
    }
  }

  return {
    ...reference,
    nodeWarning: candidates.some((candidate) => candidate.nodeWarning),
  };
}

export function isRpcSnapshotFresh(
  fetchedAt: string,
  nowMs: number,
  maxAgeMs: number,
): boolean {
  const fetchedAtMs = Date.parse(fetchedAt);
  const ageMs = nowMs - fetchedAtMs;
  return Number.isFinite(fetchedAtMs) && ageMs >= 0 && ageMs <= maxAgeMs;
}

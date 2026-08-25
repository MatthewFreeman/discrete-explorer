import { writeFile } from "node:fs/promises";

const TARGET_ATOMS = 2_100_000_000n;
const GENESIS_RESERVE_BATCHES = 21;
const GENESIS_RESERVE_BATCH_ATOMS = 5_000_000n;
const GENESIS_RESERVE_UNLOCK_STEP = 87_600;
const GENESIS_RESERVE_ATOMS =
  BigInt(GENESIS_RESERVE_BATCHES) * GENESIS_RESERVE_BATCH_ATOMS;
const MINIMUM_REWARD_ATOMS = 100n;
const BLOCKS_PER_DAY = 960;
const BLOCKS_PER_PROTOCOL_YEAR = 350_400n;
const BLOCKS_PER_PROTOCOL_MONTH = 29_200;
const BLOCK_TARGET_SECONDS = 90;
const TAIL_PERCENT = 2n;
const COIN = 100n;
const MONTHS = 120;
const ANCHOR = new Date("2026-07-24T03:51:09.000Z");

const jsonPath = new URL("../data/emission-decade.json", import.meta.url);
const csvPath = new URL("../public/data/emission-decade.csv", import.meta.url);

function rewardBranches(supply) {
  const base =
    supply < TARGET_ATOMS
      ? (TARGET_ATOMS - supply) >> 18n
      : MINIMUM_REWARD_ATOMS;
  const tail = ((supply / COIN) * TAIL_PERCENT) / BLOCKS_PER_PROTOCOL_YEAR;
  return {
    base,
    tail,
    selected: base > tail ? base : tail,
  };
}

function formatAtoms(atoms) {
  const whole = atoms / COIN;
  const fraction = (atoms % COIN).toString().padStart(2, "0");
  return `${whole}.${fraction}`;
}

function reserveUnlockedAtomsAtHeight(height) {
  const unlockedBatches = Math.min(
    GENESIS_RESERVE_BATCHES,
    Math.floor(Math.max(0, height) / GENESIS_RESERVE_UNLOCK_STEP) + 1,
  );
  return BigInt(unlockedBatches) * GENESIS_RESERVE_BATCH_ATOMS;
}

function reserveProtocolPosition(height) {
  if (height === 0) {
    return { globalMonth: 0, year: 0, month: 0 };
  }
  const globalMonth = Math.ceil(height / BLOCKS_PER_PROTOCOL_MONTH);
  return {
    globalMonth,
    year: Math.ceil(globalMonth / 12),
    month: ((globalMonth - 1) % 12) + 1,
  };
}

const shortMonth = new Intl.DateTimeFormat("en-US", {
  month: "short",
  timeZone: "UTC",
});

function dateLabel(date) {
  return `${shortMonth.format(date)} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}

function periodLabel(start, end) {
  const startMonth = shortMonth.format(start);
  const endMonth = shortMonth.format(end);
  if (start.getUTCFullYear() === end.getUTCFullYear()) {
    return `≈ ${startMonth} ${start.getUTCDate()} – ${endMonth} ${end.getUTCDate()}, ${end.getUTCFullYear()}`;
  }
  return `≈ ${startMonth} ${start.getUTCDate()}, ${start.getUTCFullYear()} – ${endMonth} ${end.getUTCDate()}, ${end.getUTCFullYear()}`;
}

function projectedTimestamp(height) {
  return new Date(
    ANCHOR.getTime() + (height - 1) * BLOCK_TARGET_SECONDS * 1_000,
  );
}

function projectedBoundaryTimestamp(blocksElapsed) {
  return new Date(
    ANCHOR.getTime() + blocksElapsed * BLOCK_TARGET_SECONDS * 1_000,
  );
}

function transitionRecord(height, supply, branches) {
  const timestamp = projectedTimestamp(height);
  return {
    blockHeight: height,
    projectedTimestamp: timestamp.toISOString(),
    projectedDate: dateLabel(timestamp),
    supplyBeforeBlockXds: formatAtoms(supply),
    baseRewardXds: formatAtoms(branches.base),
    tailRewardXds: formatAtoms(branches.tail),
    selectedRewardXds: formatAtoms(branches.selected),
  };
}

const months = [];
const protocolYears = [];
let supply = GENESIS_RESERVE_ATOMS;
let cumulativeMined = 0n;
let height = 0;
let firstTailAtLeast = null;
let firstTailStrict = null;
let tailStrictSeen = false;
let tailReversion = null;
let minimumReward = null;
let minimumRewardFirstBlock = null;
let minimumRewardLastBlock = null;
let targetCrossing = null;
let previousReserveUnlockedStart = reserveUnlockedAtomsAtHeight(0);

for (let globalMonth = 0; globalMonth < MONTHS; globalMonth += 1) {
  const blocks = BLOCKS_PER_PROTOCOL_MONTH;
  const blockStart = height + 1;
  const startDate = projectedBoundaryTimestamp(height);
  const endDate = projectedBoundaryTimestamp(height + blocks);
  const supplyStart = supply;
  const rewardStart = rewardBranches(supply);
  let monthMined = 0n;
  let rewardEnd = rewardStart;

  for (let index = 0; index < blocks; index += 1) {
    const nextHeight = height + 1;
    const branches = rewardBranches(supply);

    if (firstTailAtLeast === null && branches.tail >= branches.base) {
      firstTailAtLeast = transitionRecord(nextHeight, supply, branches);
    }
    if (firstTailStrict === null && branches.tail > branches.base) {
      firstTailStrict = transitionRecord(nextHeight, supply, branches);
      tailStrictSeen = true;
    } else if (tailStrictSeen && branches.tail < branches.base && tailReversion === null) {
      tailReversion = transitionRecord(nextHeight, supply, branches);
    }

    if (minimumReward === null || branches.selected < minimumReward) {
      minimumReward = branches.selected;
      minimumRewardFirstBlock = nextHeight;
      minimumRewardLastBlock = nextHeight;
    } else if (branches.selected === minimumReward) {
      minimumRewardLastBlock = nextHeight;
    }

    const supplyBeforeBlock = supply;

    rewardEnd = branches;
    supply += branches.selected;
    cumulativeMined += branches.selected;
    monthMined += branches.selected;
    height = nextHeight;

    if (
      targetCrossing === null &&
      supplyBeforeBlock < TARGET_ATOMS &&
      supply >= TARGET_ATOMS
    ) {
      targetCrossing = {
        blockHeight: height,
        projectedTimestamp: projectedTimestamp(height).toISOString(),
        projectedDate: dateLabel(projectedTimestamp(height)),
        supplyBeforeBlockXds: formatAtoms(supplyBeforeBlock),
        rewardXds: formatAtoms(branches.selected),
        supplyAfterBlockXds: formatAtoms(supply),
      };
    }

    if (
      height % Number(BLOCKS_PER_PROTOCOL_YEAR) === 0 &&
      height <= Number(BLOCKS_PER_PROTOCOL_YEAR) * 10
    ) {
      const protocolYear = height / Number(BLOCKS_PER_PROTOCOL_YEAR);
      const nextReward = rewardBranches(supply);
      protocolYears.push({
        year: protocolYear,
        blockHeight: height,
        targetDays: protocolYear * 365,
        projectedTimestamp: projectedTimestamp(height).toISOString(),
        projectedDate: dateLabel(projectedTimestamp(height)),
        cumulativeMinedXds: formatAtoms(cumulativeMined),
        totalSupplyXds: formatAtoms(supply),
        rewardAtBlockXds: formatAtoms(rewardEnd.selected),
        nextBlockRewardXds: formatAtoms(nextReward.selected),
        regime: firstTailStrict && height >= firstTailStrict.blockHeight ? "tail" : "base",
      });
    }
  }

  const year = Math.floor(globalMonth / 12) + 1;
  const monthOfYear = (globalMonth % 12) + 1;
  const reserveUnlockedStart = reserveUnlockedAtomsAtHeight(blockStart - 1);
  const reserveUnlockedEnd = reserveUnlockedAtomsAtHeight(height);
  const reserveUnlockEnteringMonth =
    globalMonth === 0
      ? 0n
      : reserveUnlockedStart - previousReserveUnlockedStart;
  months.push({
    year,
    month: monthOfYear,
    globalMonth: globalMonth + 1,
    period: periodLabel(startDate, endDate),
    projectedStartTimestamp: startDate.toISOString(),
    projectedEndTimestamp: endDate.toISOString(),
    targetDays: blocks / BLOCKS_PER_DAY,
    blockStart,
    blockEnd: height,
    blocks,
    supplyStartXds: formatAtoms(supplyStart),
    minedAtoms: monthMined.toString(),
    minedXds: formatAtoms(monthMined),
    cumulativeMinedXds: formatAtoms(cumulativeMined),
    totalSupplyXds: formatAtoms(supply),
    rewardStartXds: formatAtoms(rewardStart.selected),
    rewardEndXds: formatAtoms(rewardEnd.selected),
    baseRewardEndXds: formatAtoms(rewardEnd.base),
    tailRewardEndXds: formatAtoms(rewardEnd.tail),
    regimeAtEnd: rewardEnd.tail > rewardEnd.base ? "tail" : "base",
    treasuryUnlockedStartXds: formatAtoms(reserveUnlockedStart),
    treasuryUnlockEnteringMonthXds: formatAtoms(reserveUnlockEnteringMonth),
    treasuryUnlockedEndXds: formatAtoms(reserveUnlockedEnd),
    treasuryUnlockedThisMonthXds: formatAtoms(
      reserveUnlockedEnd - reserveUnlockedStart,
    ),
    treasuryLockedEndXds: formatAtoms(
      GENESIS_RESERVE_ATOMS - reserveUnlockedEnd,
    ),
    treasuryBatchesUnlockedEnd: Number(
      reserveUnlockedEnd / GENESIS_RESERVE_BATCH_ATOMS,
    ),
  });
  previousReserveUnlockedStart = reserveUnlockedStart;
}

const years = Array.from({ length: 10 }, (_, index) => {
  const year = index + 1;
  const yearMonths = months.filter((row) => row.year === year);
  const first = yearMonths[0];
  const last = yearMonths.at(-1);
  const minedAtoms = yearMonths.reduce(
    (total, row) => total + BigInt(row.minedAtoms),
    0n,
  );
  const includesTailTransition =
    firstTailStrict !== null &&
    firstTailStrict.blockHeight >= first.blockStart &&
    firstTailStrict.blockHeight <= last.blockEnd;

  return {
    year,
    period: periodLabel(
      new Date(first.projectedStartTimestamp),
      new Date(last.projectedEndTimestamp),
    ),
    targetDays: 365,
    blockStart: first.blockStart,
    blockEnd: last.blockEnd,
    blocks: yearMonths.reduce((total, row) => total + row.blocks, 0),
    minedXds: formatAtoms(minedAtoms),
    supplyStartXds: first.supplyStartXds,
    supplyEndXds: last.totalSupplyXds,
    rewardStartXds: first.rewardStartXds,
    rewardEndXds: last.rewardEndXds,
    treasuryUnlockedStartXds: first.treasuryUnlockedStartXds,
    treasuryUnlockedEndXds: last.treasuryUnlockedEndXds,
    treasuryUnlockedDuringYearXds: formatAtoms(
      yearMonths.reduce(
        (total, row) => total + BigInt(row.treasuryUnlockedThisMonthXds.replace(".", "")),
        0n,
      ),
    ),
    treasuryLockedEndXds: last.treasuryLockedEndXds,
    regime: includesTailTransition
      ? "transition"
      : last.regimeAtEnd,
    months: yearMonths,
  };
});

const treasuryUnlockSchedule = Array.from(
  { length: GENESIS_RESERVE_BATCHES },
  (_, index) => {
    const blockHeight = index * GENESIS_RESERVE_UNLOCK_STEP;
    const position = reserveProtocolPosition(blockHeight);
    const availableGlobalMonth =
      blockHeight === 0
        ? 0
        : Math.floor(blockHeight / BLOCKS_PER_PROTOCOL_MONTH) + 1;
    const availablePosition =
      availableGlobalMonth === 0
        ? { year: 0, month: 0 }
        : {
            year: Math.ceil(availableGlobalMonth / 12),
            month: ((availableGlobalMonth - 1) % 12) + 1,
          };
    const cumulativeUnlocked =
      BigInt(index + 1) * GENESIS_RESERVE_BATCH_ATOMS;
    return {
      batch: index + 1,
      amountXds: formatAtoms(GENESIS_RESERVE_BATCH_ATOMS),
      unlockBlock: blockHeight,
      projectedTimestamp:
        blockHeight === 0 ? null : projectedTimestamp(blockHeight).toISOString(),
      projectedDate:
        blockHeight === 0 ? "Genesis" : dateLabel(projectedTimestamp(blockHeight)),
      protocolYear: position.year,
      protocolMonth: position.month,
      globalMonth: position.globalMonth,
      availableFromProtocolYear: availablePosition.year,
      availableFromProtocolMonth: availablePosition.month,
      cumulativeUnlockedXds: formatAtoms(cumulativeUnlocked),
      remainingLockedXds: formatAtoms(
        GENESIS_RESERVE_ATOMS - cumulativeUnlocked,
      ),
    };
  },
);

if (!firstTailAtLeast || !firstTailStrict) {
  throw new Error("Tail transition was not reached in the modeled decade");
}
if (tailReversion) {
  throw new Error(`Tail reward reverted to base at block ${tailReversion.blockHeight}`);
}
if (
  minimumReward === null ||
  minimumRewardFirstBlock === null ||
  minimumRewardLastBlock === null ||
  targetCrossing === null
) {
  throw new Error("Reward trough or 21M crossing was not reached");
}

const output = {
  meta: {
    model: "Ten fixed 350,400-block protocol years split into twelve equal 29,200-block protocol months",
    sourceCommit: "7311efa2775af3409e167e4fc1521b024c2d4d21",
    anchorTimestamp: ANCHOR.toISOString(),
    blockTargetSeconds: BLOCK_TARGET_SECONDS,
    blocksPerDay: BLOCKS_PER_DAY,
    blocksPerProtocolYear: Number(BLOCKS_PER_PROTOCOL_YEAR),
    blocksPerProtocolMonth: BLOCKS_PER_PROTOCOL_MONTH,
    targetSupplyXds: formatAtoms(TARGET_ATOMS),
    genesisReserveXds: formatAtoms(GENESIS_RESERVE_ATOMS),
    treasuryReserve: {
      totalXds: formatAtoms(GENESIS_RESERVE_ATOMS),
      batches: GENESIS_RESERVE_BATCHES,
      batchXds: formatAtoms(GENESIS_RESERVE_BATCH_ATOMS),
      unlockStepBlocks: GENESIS_RESERVE_UNLOCK_STEP,
      genesisUnlockedXds: formatAtoms(GENESIS_RESERVE_BATCH_ATOMS),
      fullyUnlockedBlock:
        (GENESIS_RESERVE_BATCHES - 1) * GENESIS_RESERVE_UNLOCK_STEP,
      schedule: treasuryUnlockSchedule,
    },
    modeledMonths: MONTHS,
    modeledThroughBlock: height,
    tailAtLeastBase: firstTailAtLeast,
    tailStrictlyHigher: firstTailStrict,
    tailReversionObserved: false,
    minimumEffectiveReward: {
      rewardXds: formatAtoms(minimumReward),
      firstBlock: minimumRewardFirstBlock,
      lastBlock: minimumRewardLastBlock,
      firstProjectedDate: dateLabel(projectedTimestamp(minimumRewardFirstBlock)),
      lastProjectedDate: dateLabel(projectedTimestamp(minimumRewardLastBlock)),
    },
    targetSupplyCrossing: targetCrossing,
    reserveFullyUnlockedBlock: 1_752_000,
  },
  protocolYears,
  years,
};

const csvColumns = [
  "year",
  "month",
  "globalMonth",
  "period",
  "targetDays",
  "blockStart",
  "blockEnd",
  "blocks",
  "minedXds",
  "cumulativeMinedXds",
  "totalSupplyXds",
  "rewardStartXds",
  "rewardEndXds",
  "baseRewardEndXds",
  "tailRewardEndXds",
  "regimeAtEnd",
  "treasuryUnlockedStartXds",
  "treasuryUnlockEnteringMonthXds",
  "treasuryUnlockedEndXds",
  "treasuryUnlockedThisMonthXds",
  "treasuryLockedEndXds",
  "treasuryBatchesUnlockedEnd",
];
const csvRows = months.map((row) =>
  csvColumns
    .map((column) => {
      const value = String(row[column]);
      return value.includes(",") ? `"${value.replaceAll('"', '""')}"` : value;
    })
    .join(","),
);

await writeFile(jsonPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
await writeFile(csvPath, `${csvColumns.join(",")}\n${csvRows.join("\n")}\n`, "utf8");

console.log(
  `Generated ${months.length} monthly rows through block ${height.toLocaleString("en-US")}.`,
);
console.log(
  `Tail first equals/exceeds base at block ${firstTailAtLeast.blockHeight.toLocaleString("en-US")}; first strictly exceeds at block ${firstTailStrict.blockHeight.toLocaleString("en-US")}.`,
);
console.log(
  `Reward trough: ${formatAtoms(minimumReward)} XDS from block ${minimumRewardFirstBlock.toLocaleString("en-US")} through ${minimumRewardLastBlock.toLocaleString("en-US")}; 21M crossed at block ${targetCrossing.blockHeight.toLocaleString("en-US")}.`,
);

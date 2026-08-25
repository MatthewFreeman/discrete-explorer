import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const TARGET_ATOMS = 2_100_000_000n;
const GENESIS_RESERVE_ATOMS = 105_000_000n;
const GENESIS_RESERVE_BATCH_ATOMS = 5_000_000n;
const GENESIS_RESERVE_BATCHES = 21;
const GENESIS_RESERVE_UNLOCK_STEP = 87_600;
const MINIMUM_REWARD_ATOMS = 100n;
const BLOCKS_PER_PROTOCOL_YEAR = 350_400n;
const TAIL_PERCENT = 2n;
const COIN = 100n;

const CSV_COLUMNS = [
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

function csvCell(value, column, rowNumber) {
  const text = String(value);
  assert.doesNotMatch(
    text,
    /[\r\n]/,
    `CSV row ${rowNumber} column ${column} must not contain a line break`,
  );
  assert.doesNotMatch(
    text,
    /^[=+\-@\t]/,
    `CSV row ${rowNumber} column ${column} must not start with a spreadsheet formula trigger`,
  );
  return /[",]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function expectedEmissionCsv(storedData) {
  const months = storedData.years.flatMap((year) => year.months);
  const rows = months.map((row, index) =>
    CSV_COLUMNS.map((column) => csvCell(row[column], column, index + 2)).join(","),
  );
  return `${CSV_COLUMNS.join(",")}\n${rows.join("\n")}\n`;
}

export function assertEmissionCsvMatchesJson(csv, storedData) {
  assert.equal(
    csv,
    expectedEmissionCsv(storedData),
    "CSV must exactly match all 120 verified JSON rows and 22 columns",
  );
}

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

function parseAtoms(value) {
  const [whole, fraction = ""] = String(value).split(".");
  return BigInt(whole) * COIN + BigInt(fraction.padEnd(2, "0").slice(0, 2));
}

function reserveUnlockedAtomsAtHeight(height) {
  const batches = Math.min(
    GENESIS_RESERVE_BATCHES,
    Math.floor(Math.max(0, height) / GENESIS_RESERVE_UNLOCK_STEP) + 1,
  );
  return BigInt(batches) * GENESIS_RESERVE_BATCH_ATOMS;
}

const stored = JSON.parse(
  await readFile(new URL("../data/emission-decade.json", import.meta.url), "utf8"),
);
const storedCsv = await readFile(
  new URL("../public/data/emission-decade.csv", import.meta.url),
  "utf8",
);

assert.equal(stored.years.length, 10, "expected ten selectable years");
assert.equal(
  stored.years.reduce((total, year) => total + year.months.length, 0),
  120,
  "expected 120 calendar-month rows",
);
assert.equal(stored.meta.blocksPerProtocolYear, 350_400);
assert.equal(stored.meta.blocksPerProtocolMonth, 29_200);
assert.equal(stored.meta.anchorTimestamp, "2026-07-24T03:51:09.000Z");

let supply = GENESIS_RESERVE_ATOMS;
let cumulativeMined = 0n;
let height = 0;
let firstTailAtLeast = null;
let firstTailStrict = null;
let tailStrictSeen = false;
let tailReverted = false;
let minimumReward = null;
let minimumRewardFirstBlock = null;
let minimumRewardLastBlock = null;
let targetCrossing = null;
const protocolMilestones = [];
let previousUnlockedAtMonthStart = reserveUnlockedAtomsAtHeight(0);

for (const year of stored.years) {
  const yearStartHeight = height + 1;
  const yearStartSupply = supply;
  const yearStartReward = rewardBranches(supply).selected;
  let yearMined = 0n;
  assert.equal(year.blocks, 350_400);
  assert.equal(year.months.length, 12);

  for (const row of year.months) {
    const monthStart = height + 1;
    const supplyStart = supply;
    const rewardStart = rewardBranches(supply).selected;
    let monthMined = 0n;
    let rewardEnd = rewardBranches(supply);

    assert.equal(row.blocks, 29_200);
    for (let index = 0; index < row.blocks; index += 1) {
      const nextHeight = height + 1;
      const branches = rewardBranches(supply);
      if (firstTailAtLeast === null && branches.tail >= branches.base) {
        firstTailAtLeast = nextHeight;
      }
      if (firstTailStrict === null && branches.tail > branches.base) {
        firstTailStrict = nextHeight;
        tailStrictSeen = true;
      } else if (tailStrictSeen && branches.tail < branches.base) {
        tailReverted = true;
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
      yearMined += branches.selected;
      height = nextHeight;

      if (
        targetCrossing === null &&
        supplyBeforeBlock < TARGET_ATOMS &&
        supply >= TARGET_ATOMS
      ) {
        targetCrossing = {
          blockHeight: height,
          supplyBeforeBlockXds: formatAtoms(supplyBeforeBlock),
          rewardXds: formatAtoms(branches.selected),
          supplyAfterBlockXds: formatAtoms(supply),
        };
      }

      if (
        height % Number(BLOCKS_PER_PROTOCOL_YEAR) === 0 &&
        height <= Number(BLOCKS_PER_PROTOCOL_YEAR) * 10
      ) {
        protocolMilestones.push({
          year: height / Number(BLOCKS_PER_PROTOCOL_YEAR),
          blockHeight: height,
          cumulativeMinedXds: formatAtoms(cumulativeMined),
          totalSupplyXds: formatAtoms(supply),
          rewardAtBlockXds: formatAtoms(rewardEnd.selected),
          nextBlockRewardXds: formatAtoms(rewardBranches(supply).selected),
        });
      }
    }

    assert.equal(row.blockStart, monthStart);
    assert.equal(row.blockEnd, height);
    assert.equal(row.supplyStartXds, formatAtoms(supplyStart));
    assert.equal(row.minedAtoms, monthMined.toString());
    assert.equal(row.minedXds, formatAtoms(monthMined));
    assert.equal(row.cumulativeMinedXds, formatAtoms(cumulativeMined));
    assert.equal(row.totalSupplyXds, formatAtoms(supply));
    assert.equal(row.rewardStartXds, formatAtoms(rewardStart));
    assert.equal(row.rewardEndXds, formatAtoms(rewardEnd.selected));
    assert.equal(row.baseRewardEndXds, formatAtoms(rewardEnd.base));
    assert.equal(row.tailRewardEndXds, formatAtoms(rewardEnd.tail));
    const unlockedAtStart = reserveUnlockedAtomsAtHeight(row.blockStart - 1);
    const unlockedAtEnd = reserveUnlockedAtomsAtHeight(row.blockEnd);
    const unlockEnteringMonth =
      row.globalMonth === 1
        ? 0n
        : unlockedAtStart - previousUnlockedAtMonthStart;
    assert.equal(row.treasuryUnlockedStartXds, formatAtoms(unlockedAtStart));
    assert.equal(
      row.treasuryUnlockEnteringMonthXds,
      formatAtoms(unlockEnteringMonth),
    );
    assert.equal(row.treasuryUnlockedEndXds, formatAtoms(unlockedAtEnd));
    assert.equal(
      row.treasuryUnlockedThisMonthXds,
      formatAtoms(unlockedAtEnd - unlockedAtStart),
    );
    assert.equal(
      row.treasuryLockedEndXds,
      formatAtoms(GENESIS_RESERVE_ATOMS - unlockedAtEnd),
    );
    assert.equal(
      cumulativeMined + unlockedAtEnd + (GENESIS_RESERVE_ATOMS - unlockedAtEnd),
      supply,
      `Y${row.year} M${row.month} mined-plus-unlocked gap must equal locked Treasury`,
    );
    assert.equal(
      row.treasuryBatchesUnlockedEnd,
      Number(unlockedAtEnd / GENESIS_RESERVE_BATCH_ATOMS),
    );
    previousUnlockedAtMonthStart = unlockedAtStart;
  }

  const lastMonth = year.months.at(-1);
  assert.equal(year.blockStart, yearStartHeight);
  assert.equal(year.blockEnd, height);
  assert.equal(year.supplyStartXds, formatAtoms(yearStartSupply));
  assert.equal(year.supplyEndXds, formatAtoms(supply));
  assert.equal(year.minedXds, formatAtoms(yearMined));
  assert.equal(year.rewardStartXds, formatAtoms(yearStartReward));
  assert.equal(year.rewardEndXds, lastMonth.rewardEndXds);
}

assert.equal(firstTailAtLeast, 1_091_116);
assert.equal(firstTailStrict, 1_093_337);
assert.equal(tailReverted, false, "tail must remain dominant after crossover");
assert.equal(stored.meta.tailAtLeastBase.blockHeight, firstTailAtLeast);
assert.equal(stored.meta.tailStrictlyHigher.blockHeight, firstTailStrict);
assert.equal(stored.meta.tailAtLeastBase.baseRewardXds, "1.18");
assert.equal(stored.meta.tailAtLeastBase.tailRewardXds, "1.18");
assert.equal(stored.meta.tailStrictlyHigher.baseRewardXds, "1.17");
assert.equal(stored.meta.tailStrictlyHigher.tailRewardXds, "1.18");
assert.equal(stored.meta.tailReversionObserved, false);
assert.equal(minimumReward, 118n);
assert.equal(minimumRewardFirstBlock, 1_091_116);
assert.equal(minimumRewardLastBlock, 1_227_345);
assert.equal(stored.meta.minimumEffectiveReward.rewardXds, "1.18");
assert.equal(stored.meta.minimumEffectiveReward.firstBlock, minimumRewardFirstBlock);
assert.equal(stored.meta.minimumEffectiveReward.lastBlock, minimumRewardLastBlock);
assert.deepEqual(targetCrossing, {
  blockHeight: 1_354_404,
  supplyBeforeBlockXds: "20999999.78",
  rewardXds: "1.19",
  supplyAfterBlockXds: "21000000.97",
});
assert.equal(stored.meta.targetSupplyCrossing.blockHeight, targetCrossing.blockHeight);
assert.equal(stored.meta.targetSupplyCrossing.supplyBeforeBlockXds, targetCrossing.supplyBeforeBlockXds);
assert.equal(stored.meta.targetSupplyCrossing.rewardXds, targetCrossing.rewardXds);
assert.equal(stored.meta.targetSupplyCrossing.supplyAfterBlockXds, targetCrossing.supplyAfterBlockXds);
assert.equal(height, 3_504_000);
assert.equal(stored.meta.modeledThroughBlock, height);
assert.equal(formatAtoms(supply), "23729945.64");

assert.equal(stored.years[0].blockEnd, 350_400);
assert.equal(stored.years[0].minedXds, "14707800.88");
assert.equal(stored.years[0].supplyEndXds, "15757800.88");
assert.equal(stored.years[0].rewardEndXds, "19.99");
assert.equal(stored.years[1].blockEnd, 700_800);
assert.equal(stored.years[1].minedXds, "3864010.14");
assert.equal(stored.years[3].regime, "transition");
assert.equal(stored.years[9].blockEnd, 3_504_000);
assert.equal(stored.years[9].supplyEndXds, "23729945.64");

assert.equal(protocolMilestones.length, 10);
for (const [index, expected] of protocolMilestones.entries()) {
  const storedMilestone = stored.protocolYears[index];
  assert.equal(storedMilestone.year, expected.year);
  assert.equal(storedMilestone.blockHeight, expected.blockHeight);
  assert.equal(storedMilestone.cumulativeMinedXds, expected.cumulativeMinedXds);
  assert.equal(storedMilestone.totalSupplyXds, expected.totalSupplyXds);
  assert.equal(storedMilestone.rewardAtBlockXds, expected.rewardAtBlockXds);
  assert.equal(storedMilestone.nextBlockRewardXds, expected.nextBlockRewardXds);
}
assert.equal(stored.protocolYears[9].blockHeight, 3_504_000);
assert.equal(stored.protocolYears[9].totalSupplyXds, "23729945.64");
assert.equal(stored.protocolYears[9].rewardAtBlockXds, "1.35");

const treasury = stored.meta.treasuryReserve;
assert.equal(treasury.totalXds, "1050000.00");
assert.equal(treasury.batches, 21);
assert.equal(treasury.batchXds, "50000.00");
assert.equal(treasury.unlockStepBlocks, 87_600);
assert.equal(treasury.genesisUnlockedXds, "50000.00");
assert.equal(treasury.fullyUnlockedBlock, 1_752_000);
assert.equal(treasury.schedule.length, 21);
for (const [index, batch] of treasury.schedule.entries()) {
  const expectedHeight = index * GENESIS_RESERVE_UNLOCK_STEP;
  assert.equal(batch.batch, index + 1);
  assert.equal(batch.amountXds, "50000.00");
  assert.equal(batch.unlockBlock, expectedHeight);
  assert.equal(
    batch.cumulativeUnlockedXds,
    formatAtoms(BigInt(index + 1) * GENESIS_RESERVE_BATCH_ATOMS),
  );
  assert.equal(
    batch.remainingLockedXds,
    formatAtoms(
      GENESIS_RESERVE_ATOMS - BigInt(index + 1) * GENESIS_RESERVE_BATCH_ATOMS,
    ),
  );
}
assert.equal(treasury.schedule[0].projectedDate, "Genesis");
assert.equal(treasury.schedule[1].protocolYear, 1);
assert.equal(treasury.schedule[1].protocolMonth, 3);
assert.equal(treasury.schedule.at(-1).protocolYear, 5);
assert.equal(treasury.schedule.at(-1).protocolMonth, 12);
assert.equal(treasury.schedule[1].availableFromProtocolYear, 1);
assert.equal(treasury.schedule[1].availableFromProtocolMonth, 4);
assert.equal(treasury.schedule.at(-1).availableFromProtocolYear, 6);
assert.equal(treasury.schedule.at(-1).availableFromProtocolMonth, 1);
assert.equal(treasury.schedule.at(-1).remainingLockedXds, "0.00");
assert.equal(reserveUnlockedAtomsAtHeight(0), 5_000_000n);
assert.equal(reserveUnlockedAtomsAtHeight(87_599), 5_000_000n);
assert.equal(reserveUnlockedAtomsAtHeight(87_600), 10_000_000n);
assert.equal(reserveUnlockedAtomsAtHeight(87_601), 10_000_000n);
assert.equal(reserveUnlockedAtomsAtHeight(1_751_999), 100_000_000n);
assert.equal(reserveUnlockedAtomsAtHeight(1_752_000), 105_000_000n);

assert.deepEqual(
  stored.years[0].months
    .filter((row) => parseAtoms(row.treasuryUnlockEnteringMonthXds) > 0n)
    .map((row) => row.month),
  [4, 7, 10],
);
assert.equal(stored.years[1].months[0].treasuryUnlockEnteringMonthXds, "50000.00");

const year1End = stored.years[0].months.at(-1);
const year5Penultimate = stored.years[4].months.at(-2);
const year5End = stored.years[4].months.at(-1);
const minedPlusUnlocked = (row) =>
  parseAtoms(row.cumulativeMinedXds) + parseAtoms(row.treasuryUnlockedEndXds);
assert.equal(minedPlusUnlocked(year1End), 1_495_780_088n);
assert.equal(
  parseAtoms(year5Penultimate.totalSupplyXds) - minedPlusUnlocked(year5Penultimate),
  5_000_000n,
);
assert.equal(minedPlusUnlocked(year5End), parseAtoms(year5End.totalSupplyXds));

assert.deepEqual(
  stored.years.slice(0, 5).map((year) => year.treasuryUnlockedEndXds),
  ["250000.00", "450000.00", "650000.00", "850000.00", "1050000.00"],
);
assert.deepEqual(
  stored.years.slice(0, 5).map((year) => year.treasuryLockedEndXds),
  ["800000.00", "600000.00", "400000.00", "200000.00", "0.00"],
);

assertEmissionCsvMatchesJson(storedCsv, stored);

console.log(
  "Emission decade verified: 120 months, mined-plus-unlocked identity, 10 protocol-year milestones, and a permanent tail crossover at block 1,093,337.",
);

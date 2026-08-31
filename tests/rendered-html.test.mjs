import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

function xdsAtoms(value) {
  const [whole, fraction = ""] = String(value).split(".");
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0").slice(0, 2));
}

async function importTypeScriptModule(relativePath) {
  const source = await readFile(new URL(relativePath, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
}

test("requires exact two-node agreement and a fresh snapshot before publishing live data", async () => {
  const { isRpcSnapshotFresh, requireRpcQuorum } =
    await importTypeScriptModule("../app/live-chain-quorum.ts");
  const agreed = {
    chainHeight: 29458,
    tipHeight: 29457,
    tipHash: "ab".repeat(32),
    tipTimestamp: "2026-08-26T18:00:00.000Z",
    generatedSupplyXds: "3929253.24",
    nextRewardXds: "64.02",
    nodeWarning: false,
    source: "seed1",
  };

  assert.equal(requireRpcQuorum([agreed, { ...agreed, source: "seed2" }], 2).source, "seed1");
  assert.equal(
    requireRpcQuorum([agreed, { ...agreed, nodeWarning: true, source: "seed2" }], 2)
      .nodeWarning,
    true,
  );
  assert.throws(() => requireRpcQuorum([agreed], 2), /quorum is unavailable/i);

  for (const [field, value] of [
    ["tipHeight", agreed.tipHeight + 1],
    ["tipHash", "cd".repeat(32)],
    ["tipTimestamp", "2026-08-26T18:00:01.000Z"],
    ["generatedSupplyXds", "3929253.25"],
    ["nextRewardXds", "64.03"],
  ]) {
    assert.throws(
      () => requireRpcQuorum([agreed, { ...agreed, [field]: value, source: "seed2" }], 2),
      /nodes disagree/i,
      `must reject disagreement in ${field}`,
    );
  }

  const fetchedAt = "2026-08-26T18:00:00.000Z";
  const fetchedAtMs = Date.parse(fetchedAt);
  assert.equal(isRpcSnapshotFresh(fetchedAt, fetchedAtMs + 68_000, 68_000), true);
  assert.equal(isRpcSnapshotFresh(fetchedAt, fetchedAtMs + 68_001, 68_000), false);
  assert.equal(isRpcSnapshotFresh("invalid", fetchedAtMs, 68_000), false);
  assert.equal(isRpcSnapshotFresh(fetchedAt, fetchedAtMs - 1, 68_000), false);
});

test("server-renders the complete emission report", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /XDS Ten-Year Emission Explorer: A Code-Derived Analysis/i);
  assert.match(html, /Ten years of XDS emission, month by month\./i);
  assert.match(html, /One year\. Twelve months\. Two focused views\./i);
  assert.match(html, /1,093,337/);
  assert.match(html, /14,707,800\.88/);
  assert.match(html, /23,729,945\.64/);
  assert.match(html, /21 million XDS is therefore not a hard cap/i);
  assert.match(html, /scheduled unlocked.*live holder balance/is);
  assert.match(html, /Monthly protocol dynamics/i);
  assert.match(html, /Stacked bars add any Treasury batch available from that month.s first block/i);
  assert.match(html, /Unlock entering month/i);
  assert.match(html, /Circulating supply/i);
  assert.match(html, /Block reward/i);
  assert.match(html, /Consensus-generated supply/i);
  assert.match(html, /2,152,784\.31/);
  assert.match(html, /14,957,800\.88/);
  assert.match(html, /Locked Treasury batches are excluded/i);
  assert.match(html, /All 12 protocol months in the emission chart/i);
  assert.match(html, /Tap a month or choose one below for the exact readout/i);
  assert.match(html, /1\.05M XDS reserve unlocks in 21 fixed batches/i);
  assert.match(html, /Genesis · fixed.*50\.0K.*Year 5.*1\.05M/is);
  assert.match(html, /aria-label="Select Treasury protocol year"/i);
  assert.doesNotMatch(html, /class="treasury-year-selector"/i);
  assert.match(html, /Independent Treasury view/i);
  assert.match(html, /Treasury unlock schedule · Protocol Year[\s\S]*?1<\/h3>/i);
  assert.match(html, /All 12 protocol months in the Protocol Year 1 Treasury chart/i);
  assert.doesNotMatch(html, /Open unified chart/i);
  assert.match(html, /50,000 \/ 87,600 blocks/i);
  assert.match(html, /Cumulative unlocked/i);
  assert.match(html, /View all 21 exact unlock batches/i);
  assert.match(html, /Download 10 years \+ reserve/i);
  assert.match(html, /7311efa2775af3409e167e4fc1521b024c2d4d21/);
  assert.doesNotMatch(html, /audited · 7311efa|source-pill/i);
  assert.match(html, /<svg/i);
  assert.match(html, /<table/i);
  assert.doesNotMatch(html, /codex-preview|SkeletonPreview|Your site is taking shape/i);
});

test("derives cumulative mined plus scheduled-unlocked Treasury without counting locked batches", async () => {
  const stored = JSON.parse(
    await readFile(new URL("../data/emission-decade.json", import.meta.url), "utf8"),
  );
  const treasuryTotal = xdsAtoms(stored.meta.treasuryReserve.totalXds);
  let previousYearEnd = null;

  for (const [yearIndex, year] of stored.years.entries()) {
    const yearStart =
      xdsAtoms(year.supplyStartXds) -
      treasuryTotal +
      xdsAtoms(year.treasuryUnlockedStartXds);
    if (previousYearEnd === null) {
      assert.equal(yearStart, 5000000n, "the chart must anchor at the 50K genesis unlock");
    } else {
      assert.equal(yearStart, previousYearEnd, `Y${year.year} must continue from the prior year`);
    }

    let previousCombined = yearStart;
    for (const row of year.months) {
      const minedPlusUnlocked =
        xdsAtoms(row.cumulativeMinedXds) + xdsAtoms(row.treasuryUnlockedEndXds);
      const monthlyStack =
        xdsAtoms(row.minedXds) + xdsAtoms(row.treasuryUnlockedThisMonthXds);
      const consensusGenerated = xdsAtoms(row.totalSupplyXds);
      const stillLocked = xdsAtoms(row.treasuryLockedEndXds);

      assert.equal(
        minedPlusUnlocked - previousCombined,
        monthlyStack,
        `Y${row.year} M${row.month} cumulative line must add the two stacked bar components`,
      );
      assert.equal(
        consensusGenerated - minedPlusUnlocked,
        stillLocked,
        `Y${row.year} M${row.month} gap must equal the Treasury still locked`,
      );
      if (yearIndex >= 5) {
        assert.equal(
          minedPlusUnlocked,
          consensusGenerated,
          `Y${row.year} M${row.month} must converge after the Treasury fully unlocks`,
        );
      }
      previousCombined = minedPlusUnlocked;
    }
    const finalMonth = year.months.at(-1);
    previousYearEnd =
      xdsAtoms(finalMonth.cumulativeMinedXds) +
      xdsAtoms(finalMonth.treasuryUnlockedEndXds);
  }

  const year1 = stored.years[0];
  const year5 = stored.years[4];
  assert.equal(
    xdsAtoms(year1.months[0].cumulativeMinedXds) +
      xdsAtoms(year1.months[0].treasuryUnlockedEndXds),
    215278431n,
  );
  assert.equal(
    xdsAtoms(year1.months[11].cumulativeMinedXds) +
      xdsAtoms(year1.months[11].treasuryUnlockedEndXds),
    1495780088n,
  );
  assert.equal(xdsAtoms(year5.months[10].treasuryLockedEndXds), 5000000n);
  assert.equal(
    xdsAtoms(year5.months[11].cumulativeMinedXds) +
      xdsAtoms(year5.months[11].treasuryUnlockedEndXds),
    xdsAtoms(year5.months[11].totalSupplyXds),
  );
  assert.deepEqual(
    year1.months
      .filter((row) => xdsAtoms(row.treasuryUnlockedThisMonthXds) > 0n)
      .map((row) => row.month),
    [3, 6, 9, 12],
  );
  assert.deepEqual(
    year1.months
      .filter((row) => xdsAtoms(row.treasuryUnlockEnteringMonthXds) > 0n)
      .map((row) => row.month),
    [4, 7, 10],
  );
  assert.equal(year1.months[2].treasuryUnlockEnteringMonthXds, "0.00");
  assert.equal(year1.months[3].treasuryUnlockEnteringMonthXds, "50000.00");
});

test("renders Treasury unlocks as a separate monthly stacked-bar segment", async () => {
  const [response, css] = await Promise.all([
    render(),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  const html = await response.text();

  assert.equal((html.match(/class="miner-segment"/g) ?? []).length, 24);
  assert.equal((html.match(/class="unlock-segment"/g) ?? []).length, 6);
  assert.equal((html.match(/data-unlock-xds="50000\.00"/g) ?? []).length, 6);
  assert.doesNotMatch(html, /data-unlock-xds="0\.00"/);
  assert.equal((html.match(/class="unlock-value-label"/g) ?? []).length, 3);
  assert.match(html, /MONTHLY MINED \+ UNLOCK ENTERING MONTH · XDS/);
  assert.match(html, /Treasury unlock entering month:/i);
  assert.match(html, /Stacked total:/i);
  assert.match(html, /Treasury:/i);
  assert.match(html, /XDS still locked/i);
  assert.match(css, /\.combined-bar \.unlock-segment\s*\{[^}]*fill:\s*var\(--amber\)/is);
  assert.match(css, /\.legend-swatch\.bars\.unlock\s*\{[^}]*background:\s*var\(--amber\)/is);
});

test("includes accessible navigation and chart controls", async () => {
  const [response, css] = await Promise.all([
    render(),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  const html = await response.text();

  assert.match(html, /aria-label="Report navigation"/i);
  assert.match(html, /aria-label="Mobile report navigation"/i);
  const desktopNavigation = html.match(/<nav class="nav-links"[\s\S]*?<\/nav>/i)?.[0] ?? "";
  assert.match(desktopNavigation, /href="#explorer">Emission<\/a>/i);
  assert.doesNotMatch(desktopNavigation, /href="#explorer">Explorer<\/a>/i);
  assert.match(html, /Explore emission ↓/i);
  assert.match(html, /aria-labelledby="year-selector-label"/i);
  assert.doesNotMatch(html, /type="range"/i);
  assert.doesNotMatch(html, /aria-valuetext=/i);
  assert.match(html, /aria-label="Emission protocol month navigation"/i);
  assert.match(html, /aria-label="Treasury protocol month navigation"/i);
  assert.match(html, /aria-describedby="line-overlay-definition"/i);
  assert.match(
    html,
    /data-selected="true"[^>]*aria-pressed="true"[^>]*>Circulating supply<\/button>/i,
  );
  assert.match(
    html,
    /data-selected="false"[^>]*aria-pressed="false"[^>]*>Block reward<\/button>/i,
  );
  const toggleMarkup = html.match(/<fieldset class="line-metric-toggle"[\s\S]*?<\/fieldset>/i)?.[0] ?? "";
  assert.equal((toggleMarkup.match(/<button\b/gi) ?? []).length, 2);
  assert.doesNotMatch(toggleMarkup, /Generated supply|Treasury reserve/i);
  assert.match(html, /aria-label="Select emission protocol month"/i);
  assert.match(html, /aria-label="Select treasury protocol month"/i);
  assert.match(html, /aria-describedby="emission-month-select-period"/i);
  assert.match(html, /aria-describedby="treasury-month-select-period"/i);
  assert.match(html, /id="emission-month-select-period"/i);
  assert.match(html, /id="treasury-month-select-period"/i);
  assert.equal((html.match(/<select\b/gi) ?? []).length, 2);
  assert.equal((html.match(/<option\b/gi) ?? []).length, 24);
  assert.match(html, /aria-pressed=/i);
  assert.match(html, /aria-live="polite"/i);
  assert.match(html, /aria-atomic="true"/i);
  assert.match(css, /prefers-reduced-motion/i);
  assert.match(css, /prefers-contrast/i);
  assert.match(
    css,
    /@media \(max-width: 980px\)[\s\S]*?\.line-metric-toggle\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/i,
  );
  assert.match(
    css,
    /@media \(max-width: 740px\)[\s\S]*?\.line-metric-toggle\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/i,
  );
  assert.match(
    css,
    /@media \(max-width: 980px\)[\s\S]*?\.method-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/i,
  );
  assert.match(
    css,
    /@media \(max-width: 980px\)[\s\S]*?\.mechanics-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/i,
  );
  assert.match(css, /#unified-chart\s*\{[^}]*scroll-margin-top:/is);
});

test("anchors Today markers and swaps the shared readout to the exact live tip", async () => {
  const [response, liveSource, chartSource, reportSource, css] = await Promise.all([
    render(),
    readFile(new URL("../app/live-chain.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/InteractiveCharts.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/EmissionReport.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  const html = await response.text();

  assert.match(liveSource, /https:\/\/seed1\.discrete\.cash:9332/);
  assert.match(liveSource, /https:\/\/seed2\.discrete\.cash:9332/);
  assert.match(liveSource, /requireRpcQuorum\(candidates, RPC_ENDPOINTS\.length\)/);
  assert.match(liveSource, /headerHash !== infoHash/);
  assert.match(liveSource, /status: "error",\s*snapshot: null/);
  assert.match(liveSource, /isRpcSnapshotFresh\(current\.snapshot\.fetchedAt/);
  assert.match(liveSource, /visibilitychange/);
  assert.match(liveSource, /SNAPSHOT_MAX_AGE_MS - \(Date\.now\(\) - fetchedAtMs\)/);
  assert.match(liveSource, /Live RPC snapshot expired/);
  assert.match(liveSource, /const tipHeight = chainHeight - 1/);
  assert.match(liveSource, /method: "getblockheaderbyheight"/);
  assert.match(liveSource, /info\.already_generated_coins/);
  assert.match(liveSource, /info\.next_reward/);
  assert.match(
    liveSource,
    /Math\.floor\(\s*\(tipHeight - 1\) \/ emissionData\.meta\.blocksPerProtocolMonth/,
  );
  assert.match(liveSource, /minerIssuanceAtoms \+ treasuryUnlockedAtoms/);
  assert.match(
    chartSource,
    /liveXWithinMonthBar\(liveTip, year, left, step, 0\.56\)/,
  );
  assert.match(
    chartSource,
    /centerX - barWidth \/ 2 \+ progress \* barWidth/,
  );
  assert.match(chartSource, /isTodaySelected &&/);
  assert.match(chartSource, /manualPosition === null &&/);
  assert.match(
    chartSource,
    /className="live-tip-callout" visibility=\{liveControl\.active \? "visible" : "hidden"\}/,
  );
  assert.match(chartSource, /className="live-tip-marker"/);
  assert.match(chartSource, /className="live-tip-callout"/);
  assert.match(
    chartSource,
    /LIVE TIP · M\{\(liveTip\.monthIndex \?\? 0\) \+ 1\} · H \{formatInteger\(liveTip\.tipHeight\)\}/,
  );
  assert.match(chartSource, /liveTip\.minedPlusScheduledUnlockedXds/);
  assert.match(chartSource, /liveTip\.nextRewardXds/);
  assert.match(chartSource, /liveTip\.treasuryUnlockedXds/);
  assert.match(chartSource, /liveDateTimeLabel\(liveTip\)/);
  assert.match(reportSource, /const todaySnapshot = isTodaySelected \? liveChain\.snapshot : null/);
  assert.match(reportSource, /todaySnapshot && todayCadence/);
  assert.match(reportSource, /Actual chain tip readout/);
  assert.match(reportSource, /Circulating supply/);
  assert.match(reportSource, /todaySnapshot\.minedPlusScheduledUnlockedXds/);
  assert.match(reportSource, /Treasury unlocked/);
  assert.match(reportSource, /Target-cadence drift/);
  assert.match(reportSource, /expectedHeight - snapshot\.tipHeight/);
  assert.match(reportSource, /averageSecondsPerBlock/);
  assert.match(reportSource, /Target-cadence projection · 90 s\/block/);
  assert.match(chartSource, /Target · \{period\}/);
  assert.doesNotMatch(reportSource, /function LiveTipReadout|<LiveTipReadout/);
  assert.doesNotMatch(reportSource, /Generated supply at tip/);
  assert.equal((html.match(/Connecting to RPC/g) ?? []).length, 2);
  assert.match(css, /\.live-tip-marker line/);
  assert.match(css, /\.live-tip-callout rect/);
  assert.match(css, /\.live-tip-callout-value/);
  assert.match(css, /\.today-button/);
  assert.doesNotMatch(
    chartSource,
    /className="today-button"[\s\S]{0,180}(?:data-active|aria-pressed)=/,
  );
  assert.doesNotMatch(css, /\.month-navigator \.today-button\[data-active=/);
  assert.doesNotMatch(
    css,
    /\.month-navigator \.today-button\s*\{[^}]*\b(?:background|border-color|box-shadow|color)\s*:/i,
  );
  assert.equal(
    (chartSource.match(/className="selected-month-band"[\s\S]{0,220}visibility=\{liveControl\.active \? "hidden" : "visible"\}/g) ?? []).length,
    4,
  );
  assert.equal(
    (chartSource.match(/data-selected=\{index === selected(?:Index|MonthIndex) && !liveControl\.active\}/g) ?? []).length,
    4,
  );
  assert.match(chartSource, /const mobileSelectedOverlayLabelX = Math\.max\(/);
  assert.match(chartSource, /x=\{mobileSelectedOverlayLabelX\}/);
  assert.equal(
    (chartSource.match(/className=\{`selected-overlay-label \$\{lineMetric\}`\} visibility=\{liveControl\.active \? "hidden" : "visible"\}/g) ?? []).length,
    2,
  );
});

test("keeps the yearly emission table compact without dropping exact data", async () => {
  const [response, css] = await Promise.all([
    render(),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  const html = await response.text();
  const table =
    html.match(/<table class="data-table emission-data-table"[\s\S]*?<\/table>/i)?.[0] ?? "";

  assert.notEqual(table, "");
  assert.equal((table.match(/<th\b/gi) ?? []).length, 6);
  assert.equal((table.match(/<td\b/gi) ?? []).length, 72);
  assert.match(table, /Month \/ target dates/i);
  assert.match(table, /Monthly flow · XDS/i);
  assert.match(table, /Treasury at month start · XDS/i);
  assert.match(table, /Cumulative totals · XDS/i);
  assert.match(table, /Reward · XDS \/ block/i);
  assert.match(table, /Miner issuance/i);
  assert.match(table, /Circulating supply/i);
  assert.match(table, /generated/i);
  assert.doesNotMatch(table, /<th>Projected dates<\/th>/i);
  assert.doesNotMatch(table, /<th>Reward start<\/th>/i);
  assert.match(css, /\.emission-table-wrap\s*\{[^}]*overflow-x:\s*hidden/is);
  assert.match(css, /\.emission-data-table\s*\{[^}]*table-layout:\s*fixed/is);
  assert.match(
    css,
    /@media \(max-width: 820px\)[\s\S]*?\.emission-data-table tbody tr\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/i,
  );
});

test("shows boundary unlocks in the following protocol month", async () => {
  const [response, source, reportSource, stored, css] = await Promise.all([
    render(),
    readFile(new URL("../app/InteractiveCharts.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/EmissionReport.tsx", import.meta.url), "utf8"),
    readFile(new URL("../data/emission-decade.json", import.meta.url), "utf8").then(JSON.parse),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  const html = await response.text();
  const year1 = stored.years[0];
  const combinedSource = source.slice(0, source.indexOf("export function TreasuryExplorer"));
  const exactScheduleTable =
    html.match(/<table class="data-table treasury-data-table">[\s\S]*?Exact genesis Treasury Reserve unlock schedule[\s\S]*?<\/table>/i)?.[0] ?? "";

  assert.match(source, /const centerX = left \+ step \* \(index \+ 0\.5\)/);
  assert.match(source, /const centerX = mobileLeft \+ mobileStep \* \(index \+ 0\.5\)/);
  assert.match(source, /let stepPath = `M \$\{left\} \$\{y\(Number\(rows\[0\]\.treasuryUnlockedStartXds\)\)\}`/);
  assert.match(source, /const boundaryX = left \+ step \* \(index \+ 1\)/);
  assert.match(source, /stepPath \+= ` H \$\{boundaryX\}`/);
  assert.match(source, /stepPath \+= ` V \$\{y\(Number\(nextRow\.treasuryUnlockedStartXds\)\)\}`/);
  assert.match(source, /className="treasury-unlock-cap"/);
  assert.match(source, /className="unlock-label"/);
  assert.match(source, /const unlockEnteringMonth = Number\(row\.treasuryUnlockEnteringMonthXds\)/);
  assert.match(source, /const mobileBoundaryX = mobileLeft \+ mobileStep \* \(index \+ 1\)/);
  assert.match(source, /x: left \+ step \* \(selectedMonthIndex \+ 0\.5\)/);
  assert.match(source, /y: y\(Number\(selected\.treasuryUnlockedStartXds\)\)/);
  assert.match(source, /className="treasury-step-line"/);
  assert.doesNotMatch(combinedSource, /treasury-step-line|selected-treasury-label/);
  assert.match(combinedSource, /niceCeiling\(Math\.max\(\.\.\.monthlyFlowValues\) \* 1\.04\)/);
  assert.match(source, /const minerLabelY = minedY \+ Math\.min\(14, minedHeight \/ 2\)/);
  assert.match(source, /dominantBaseline="middle"/);
  assert.match(source, /const displayedOverlayPoints = overlayPoints\.slice\(1\)/);
  assert.match(source, /const overlayPath = linePath\(displayedOverlayPoints\)/);
  assert.match(source, /const mobileDisplayedOverlayPoints = mobileOverlayPoints\.slice\(1\)/);
  assert.match(source, /const mobileOverlayPath = linePath\(mobileDisplayedOverlayPoints\)/);
  assert.equal(
    (source.match(/onMouseEnter=\{\(\) => (?:onSelect|selectMonth)\(index\)\}/g) ?? []).length,
    2,
    "both desktop charts must follow the hovered month while mobile remains tap-only",
  );
  assert.doesNotMatch(combinedSource, /left \+ plotWidth\} \$\{displayedOverlayPoints/);
  assert.doesNotMatch(combinedSource, /mobileLeft \+ mobilePlotWidth\} \$\{mobileDisplayedOverlayPoints/);
  assert.doesNotMatch(source, /unlock > 0 \? minedY \+ 14/);
  assert.match(source, /x: index === 0 \? left : left \+ step \* \(index - 0\.5\)/);
  assert.match(source, /x: index === 0 \? mobileLeft : mobileLeft \+ mobileStep \* \(index - 0\.5\)/);
  assert.equal((html.match(/class="treasury-step-line"/g) ?? []).length, 2);
  assert.equal((html.match(/class="treasury-month-bar"/g) ?? []).length, 24);
  assert.equal((html.match(/class="treasury-unlock-cap"/g) ?? []).length, 3);
  assert.equal((html.match(/class="unlock-label"/g) ?? []).length, 3);
  assert.equal((html.match(/class="combined-overlay-line unlocked"/g) ?? []).length, 2);
  assert.equal((html.match(/class="combined-overlay-point unlocked"/g) ?? []).length, 2);
  assert.equal((html.match(/class="selected-treasury-label"/g) ?? []).length, 2);
  assert.match(
    source,
    /className="selected-treasury-label" visibility=\{liveControl\.active \? "hidden" : "visible"\}/,
  );
  assert.match(source, /const mobileSelectedTreasuryLabelX = Math\.max\(/);
  assert.match(source, /x=\{mobileSelectedTreasuryLabelX\}/);
  assert.match(html, /Amber caps use the same monthly XDS scale as miner issuance/i);
  assert.equal((html.match(/class="overlay-definition-copies"/g) ?? []).length, 1);
  assert.equal((html.match(/class="line-legend-labels"/g) ?? []).length, 1);
  assert.match(html, /data-active="true"[^>]*>Amber caps[\s\S]*?The main line shows circulating supply/i);
  assert.match(html, /aria-hidden="true"[^>]*data-active="false"[^>]*>Amber caps[\s\S]*?The main line shows reward/i);
  assert.match(css, /\.overlay-definition-copies\s*\{[^}]*display:\s*grid/is);
  assert.match(css, /\.line-legend-labels\s*\{[^}]*display:\s*grid/is);
  assert.match(css, /\.overlay-definition-copies > span\s*\{[^}]*grid-area:\s*1\s*\/\s*1[^}]*visibility:\s*hidden/is);
  assert.doesNotMatch(css, /\.overlay-definition[^}]*box-shadow:\s*inset\s+2px\s+0/is);
  assert.match(css, /\.combined-chart-svg \.axis-title:not\(\.right\),\s*\.combined-chart-svg \.axis-text:not\(\.right\)\s*\{[^}]*fill:\s*var\(--mint\)/is);
  assert.match(source, /<text x=\{equalityStart - 7\} y=\{top \+ 14\} textAnchor="end">/);
  assert.match(source, /kind: "tail",\s*labelSide: "left"/);
  assert.match(source, /kind: "target",\s*labelSide: "left"/);
  assert.doesNotMatch(html, /treasury-rail/i);
  assert.match(html, /treasury-chart-svg|treasury-month-bar|treasury-month-select/i);
  assert.doesNotMatch(source, /scrollIntoView|requestAnimationFrame|onInspectYear|document\.getElementById\("unified-chart"\)/);
  assert.match(source, /\{yearControls\}\s*<div className="chart-viewport desktop-chart-viewport"/);
  assert.match(reportSource, /<CombinedEmissionChart[\s\S]*?yearControls=\{\([\s\S]*?className="year-selector-shell emission-year-selector-shell"/);
  assert.doesNotMatch(
    reportSource.slice(0, reportSource.indexOf('<div className="year-context"')),
    /year-selector-shell/,
  );
  assert.doesNotMatch(reportSource, /<TreasuryExplorer[\s\S]*?selectedYearIndex=|onInspectYear=/);
  assert.match(
    reportSource,
    /<TreasuryExplorer[\s\S]*?liveTip=\{liveChain\.snapshot\}[\s\S]*?\/>/,
  );
  assert.notEqual(
    year1.months[2].treasuryUnlockedEndXds,
    year1.months[1].treasuryUnlockedEndXds,
    "M3 must include its 50K unlock",
  );
  assert.equal(
    year1.months[2].blockEnd,
    stored.meta.treasuryReserve.schedule[1].unlockBlock,
    "the second Treasury batch unlocks on the final block of M3",
  );
  assert.equal(
    year1.months[3].blockStart,
    stored.meta.treasuryReserve.schedule[1].unlockBlock + 1,
    "M4 starts immediately after the block-87,600 unlock boundary",
  );
  assert.equal(year1.months[2].treasuryUnlockedStartXds, "50000.00");
  assert.equal(year1.months[3].treasuryUnlockedStartXds, "100000.00");
  assert.match(exactScheduleTable, /<th>Spendable at block<\/th>/i);
  assert.match(exactScheduleTable, /<th>Consensus unlock month<\/th>/i);
  assert.doesNotMatch(exactScheduleTable, /<th>Available from<\/th>/i);
  assert.match(exactScheduleTable, /87,600[\s\S]*?Y1 · M3 · final block/i);
  assert.match(exactScheduleTable, /1,752,000[\s\S]*?Y5 · M12 · final block/i);
  assert.match(exactScheduleTable, /class="data-table treasury-data-table"/i);
  assert.match(exactScheduleTable, /data-label="Spendable at block"/i);
  assert.match(css, /\.treasury-table-wrap\s*\{[^}]*overflow-x:\s*hidden/is);
  assert.match(
    css,
    /@media \(max-width: 820px\)[\s\S]*?\.treasury-data-table tbody tr\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/i,
  );
  assert.equal(
    xdsAtoms(year1.months[2].treasuryUnlockedEndXds) +
      xdsAtoms(year1.months[2].treasuryLockedEndXds),
    xdsAtoms(stored.meta.treasuryReserve.totalXds),
  );
});

test("rejects corrupted CSV data and serializes quoted cells safely", async () => {
  const [{ assertEmissionCsvMatchesJson, expectedEmissionCsv }, stored, storedCsv] = await Promise.all([
    import(new URL("../scripts/verify-emission.mjs", import.meta.url)),
    readFile(new URL("../data/emission-decade.json", import.meta.url), "utf8").then(JSON.parse),
    readFile(new URL("../public/data/emission-decade.csv", import.meta.url), "utf8"),
  ]);

  assert.doesNotThrow(() => assertEmissionCsvMatchesJson(storedCsv, stored));

  const lines = storedCsv.trimEnd().split("\n");
  const middleRowIndex = stored.years[4].months[10].globalMonth;
  const originalMined = stored.years[4].months[10].minedXds;
  assert.match(lines[middleRowIndex], new RegExp(`,${originalMined.replace(".", "\\.")},`));
  lines[middleRowIndex] = lines[middleRowIndex].replace(
    `,${originalMined},`,
    ",999999.99,",
  );
  const corruptedCsv = `${lines.join("\n")}\n`;
  assert.throws(
    () => assertEmissionCsvMatchesJson(corruptedCsv, stored),
    /must exactly match all 120 verified JSON rows and 22 columns/i,
  );

  for (const formula of ["=1+1", "+1+1", "-1+1", "@SUM(1,1)", "\t=1+1"]) {
    const formulaData = structuredClone(stored);
    formulaData.years[4].months[10].period = formula;
    assert.throws(
      () => assertEmissionCsvMatchesJson(storedCsv, formulaData),
      /must not start with a spreadsheet formula trigger/i,
    );
  }

  const newlineData = structuredClone(stored);
  newlineData.years[4].months[10].period = "safe-looking\n=1+1";
  assert.throws(
    () => expectedEmissionCsv(newlineData),
    /must not contain a line break/i,
  );

  const quotedData = structuredClone(stored);
  quotedData.years[4].months[10].period = 'A "quoted" label';
  assert.match(expectedEmissionCsv(quotedData), /,"A ""quoted"" label",/);
});
test("renders one local Treasury year selector immediately above its own chart", async () => {
  const [response, source, css] = await Promise.all([
    render(),
    readFile(new URL("../app/InteractiveCharts.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  const html = await response.text();
  const selectedRule = css.match(
    /button\.treasury-horizon-item\[data-selected="true"\]\s*\{([^}]*)\}/i,
  )?.[1] ?? "";

  assert.match(selectedRule, /background:/i);
  assert.match(selectedRule, /box-shadow:\s*inset 0 0 0 1px/i);
  assert.doesNotMatch(selectedRule, /inset\s+0\s+-\d+px/i);
  assert.match(html, /Genesis · fixed/i);
  assert.match(html, /Choose the Treasury protocol year/i);
  assert.match(html, /The selected month stays in place/i);
  assert.match(
    html,
    /class="treasury-horizon-item"[^>]*data-selected="true"[^>]*aria-pressed="true"/i,
  );
  assert.equal((html.match(/<button\b[^>]*class="treasury-horizon-item"/gi) ?? []).length, 5);
  assert.match(css, /\.treasury-horizon-grid\s*\{[^}]*gap:\s*8px[^}]*padding:\s*8px/is);
  assert.match(css, /\.treasury-horizon-item\s*\{[^}]*border:\s*1px solid[^}]*border-radius:\s*10px/is);
  assert.match(
    css,
    /button\.treasury-horizon-item \.treasury-horizon-value > span::before\s*\{[^}]*border-radius:\s*50%/is,
  );
  assert.doesNotMatch(css, /\.treasury-horizon-item \+ \.treasury-horizon-item/);
  assert.match(source, /<\/div>\s*<\/div>\s*<div className="chart-viewport desktop-chart-viewport treasury-chart-viewport"/);
  assert.equal((html.match(/aria-label="Select Treasury protocol year"/gi) ?? []).length, 1);
});

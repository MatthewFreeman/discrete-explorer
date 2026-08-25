"use client";

import { useState } from "react";
import emissionData from "@/data/emission-decade.json";
import {
  CombinedEmissionChart,
  TreasuryExplorer,
  type ChartOverlay,
} from "./InteractiveCharts";

type YearData = (typeof emissionData.years)[number];
type MonthData = YearData["months"][number];

const sourceCommit = "7311efa2775af3409e167e4fc1521b024c2d4d21";
const sourceRoot = `https://github.com/discretecoin/discrete/blob/${sourceCommit}`;
const tailBlock = emissionData.meta.tailStrictlyHigher.blockHeight;
const atomsPerXds = BigInt(100);
const explorerHome = process.env.NEXT_PUBLIC_EXPLORER_HOME;

const formatNumber = (value: string | number, digits = 2) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(value));

const formatInteger = (value: string | number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(
    Number(value),
  );

const xdsAtoms = (value: string | number) => {
  const [whole, fraction = ""] = String(value).split(".");
  return (
    BigInt(whole) * atomsPerXds +
    BigInt(fraction.padEnd(2, "0").slice(0, 2))
  );
};

const formatAtoms = (atoms: bigint) =>
  `${new Intl.NumberFormat("en-US").format(atoms / atomsPerXds)}.${(
    atoms % atomsPerXds
  )
    .toString()
    .padStart(2, "0")}`;

const minedPlusAvailableAtMonthStartXds = (row: MonthData) =>
  xdsAtoms(row.cumulativeMinedXds) + xdsAtoms(row.treasuryUnlockedStartXds);

const minedPlusScheduledUnlockedAtExactEndXds = (row: MonthData) =>
  xdsAtoms(row.cumulativeMinedXds) + xdsAtoms(row.treasuryUnlockedEndXds);

const monthlyStackXds = (row: MonthData) =>
  xdsAtoms(row.minedXds) + xdsAtoms(row.treasuryUnlockEnteringMonthXds);

const treasuryLockedAtMonthStartXds = (row: MonthData) =>
  xdsAtoms(emissionData.meta.treasuryReserve.totalXds) -
  xdsAtoms(row.treasuryUnlockedStartXds);

export function EmissionReport() {
  const years = emissionData.years as YearData[];
  const transitionYearIndex = years.findIndex(
    (year) => tailBlock >= year.blockStart && tailBlock <= year.blockEnd,
  );
  const [selectedYearIndex, setSelectedYearIndex] = useState(0);
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(0);
  const [chartOverlay, setChartOverlay] = useState<ChartOverlay>("unlocked");
  const selectedYear = years[selectedYearIndex];
  const selected = selectedYear.months[selectedMonthIndex];
  const selectedYearEnd = selectedYear.months[selectedYear.months.length - 1];

  const selectYear = (index: number) => {
    setSelectedYearIndex(index);
  };

  return (
    <div className="site-shell">
      <header className="site-header">
        <div className="container header-inner">
          <a
            className="brand"
            href={explorerHome || "#top"}
            aria-label={explorerHome ? "Back to Discrete Explorer" : "Discrete emission report home"}
          >
            {/* Relative by design: portable under the GitHub Pages project subpath. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="logo.svg" alt="" width="30" height="30" />
            <span>
              <span>Discrete / Emission Explorer</span>
              <small>Consensus, not marketing</small>
            </span>
          </a>
          <nav className="nav-links" aria-label="Report navigation">
            <a href="#explorer">Explorer</a>
            <a href="#treasury">Treasury</a>
            <a href="#mechanics">Mechanics</a>
            <a href="#sources">Sources</a>
          </nav>
        </div>
        <nav className="mobile-section-nav" aria-label="Mobile report navigation">
          <a href="#explorer">Emission</a>
          <a href="#treasury">Treasury</a>
          <a href="#mechanics">Mechanics</a>
          <a href="#sources">Sources</a>
        </nav>
      </header>

      <main id="top">
        <section className="hero">
          <div className="container">
            <div className="hero-grid">
              <div>
                <p className="eyebrow">Consensus analysis · Blocks 1–3,504,000</p>
                <h1>Ten years of XDS emission, month by month.</h1>
                <p className="hero-lede">
                  A sequential, unpenalized full-reward reconstruction of
                  Discrete&apos;s integer reward formula. Choose any protocol year to
                   inspect monthly miner issuance, the mined-plus-scheduled-unlocked path,
                   Treasury schedule, and the reward curve—including the point
                  where the perpetual tail becomes dominant.
                </p>
                <div className="hero-actions" aria-label="Explore the report">
                  <a className="hero-action primary" href="#explorer">Explore emission ↓</a>
                  <a className="hero-action" href="#treasury">Treasury unlocks</a>
                </div>
              </div>
              <aside className="result-panel" aria-label="Tail-emission transition">
                <div className="result-label">Tail dominates the full-reward path at block</div>
                <div className="result-number">1,093,337</div>
                <div className="result-unit">Projected Sep 5, 2029 · 1.18 XDS/block</div>
                <p className="result-warning">
                  21M is not a hard cap. Percentage-based tail issuance continues
                  indefinitely.
                </p>
              </aside>
            </div>

            <div className="metric-strip" aria-label="Key emission metrics">
              <div className="metric">
                <div className="metric-value">15,757,800.88</div>
                <div className="metric-label">XDS generated at block 350,400 · Year 1</div>
              </div>
              <div className="metric">
                <div className="metric-value">23,729,945.64</div>
                <div className="metric-label">XDS generated at block 3,504,000 · Year 10</div>
              </div>
              <div className="metric">
                <div className="metric-value">1,091,116</div>
                <div className="metric-label">First block where base and tail both equal 1.18</div>
              </div>
              <div className="metric">
                <div className="metric-value">76.10 → 1.35</div>
                <div className="metric-label">First reward → Year 10 reward · XDS/block</div>
              </div>
            </div>
          </div>
        </section>

        <section className="section" id="explorer">
          <div className="container">
            <div className="section-heading">
              <div>
                <p className="section-kicker">Ten-year emission explorer</p>
                <h2>One year. Twelve months. Two focused views.</h2>
              </div>
              <p className="section-intro">
                Each year is exactly 350,400 target blocks, split into 12 equal
                29,200-block protocol months. Projected UTC dates are secondary; exact
                block ranges are the authoritative reference. Values assume no
                block-size reward penalty. Emission controls stay here; the Treasury
                section has its own independent five-year schedule.
              </p>
            </div>

            <div className="year-context" aria-live="polite">
              <div className="year-context-heading">
                <div>
                  <span>Protocol Year {selectedYear.year}</span>
                  <strong>{selectedYear.period}</strong>
                </div>
                <span className={`regime-badge ${selectedYear.regime}`}>
                  {selectedYear.regime === "transition"
                    ? "Tail crossover"
                    : `${selectedYear.regime} regime`}
                </span>
              </div>
              <div className="year-metrics">
                <div>
                  <span>Exact blocks</span>
                  <strong>
                    {formatInteger(selectedYear.blockStart)}–{formatInteger(selectedYear.blockEnd)}
                  </strong>
                </div>
                <div>
                  <span>Miner issuance</span>
                  <strong>{formatNumber(selectedYear.minedXds)} XDS</strong>
                </div>
                <div>
                  <span>Mined + scheduled unlocked at year end</span>
                  <strong>{formatAtoms(minedPlusScheduledUnlockedAtExactEndXds(selectedYearEnd))} XDS</strong>
                </div>
                <div>
                  <span>Reward across year</span>
                  <strong>
                    {selectedYear.rewardStartXds} → {selectedYear.rewardEndXds}
                  </strong>
                </div>
              </div>
            </div>

            <div className="chart-shell">
              <div className="chart-toolbar">
                <div className="chart-legend" aria-label="Explorer status">
                  <span className="legend-item">
                    <span className="legend-bar" aria-hidden="true" /> Selected month
                    updates the chart and exact readout
                  </span>
                  {selectedYearIndex === transitionYearIndex ? (
                    <span className="legend-item tail-legend">
                      <span aria-hidden="true" /> Exact tail events shown on the chart
                    </span>
                  ) : null}
                </div>
                <a className="download-link" href="data/emission-decade.csv" download>
                  Download 10 years + reserve · CSV ↓
                </a>
              </div>

              <CombinedEmissionChart
                year={selectedYear}
                selectedIndex={selectedMonthIndex}
                onSelect={setSelectedMonthIndex}
                lineMetric={chartOverlay}
                onLineMetricChange={setChartOverlay}
                yearControls={(
                  <div className="year-selector-shell emission-year-selector-shell">
                    <div className="year-selector-head">
                      <span id="year-selector-label">Choose the protocol year</span>
                      <span>Year 1–10 · selected year updates this chart</span>
                    </div>
                    <div
                      className="year-selector"
                      role="group"
                      aria-labelledby="year-selector-label"
                    >
                      {years.map((year, index) => (
                        <button
                          className="year-button"
                          data-selected={index === selectedYearIndex}
                          data-regime={year.regime}
                          key={year.year}
                          type="button"
                          aria-pressed={index === selectedYearIndex}
                          aria-label={`Protocol Year ${year.year}, ${year.regime} emission regime`}
                          onClick={() => selectYear(index)}
                        >
                          <span>Y{year.year}</span>
                          <small>{year.regime === "transition" ? "Crossover" : year.regime}</small>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              />

              <div className="chart-readout" role="status" aria-live="polite" aria-atomic="true">
                <div className="readout-item">
                  <div className="readout-label">
                    Year {selected.year} · Month {selected.month}
                  </div>
                  <div className="readout-value">{selected.period}</div>
                </div>
                <div className="readout-item">
                  <div className="readout-label">Exact blocks</div>
                  <div className="readout-value">
                    {formatInteger(selected.blockStart)}–{formatInteger(selected.blockEnd)}
                  </div>
                </div>
                <div className="readout-item">
                  <div className="readout-label">Miner issuance</div>
                  <div className="readout-value">{formatNumber(selected.minedXds)} XDS</div>
                  <div
                    className="readout-subvalue"
                    data-active={Number(selected.treasuryUnlockEnteringMonthXds) > 0}
                  >
                    Treasury unlock entering month: {formatNumber(selected.treasuryUnlockEnteringMonthXds)} XDS
                    <br />
                    Stacked total: {formatAtoms(monthlyStackXds(selected))} XDS
                  </div>
                </div>
                <div className="readout-item">
                  <div className="readout-label">Mined through month + Treasury available at start</div>
                  <div className="readout-value">
                    {formatAtoms(minedPlusAvailableAtMonthStartXds(selected))} XDS
                  </div>
                  <div className="readout-subvalue">
                    Treasury: {formatNumber(selected.treasuryUnlockedStartXds)} XDS available from month start
                    <br />
                    {formatAtoms(treasuryLockedAtMonthStartXds(selected))} XDS still locked at month start
                  </div>
                </div>
                <div className="readout-item">
                  <div className="readout-label">Reward across month</div>
                  <div className="readout-value">
                    {selected.rewardStartXds} → {selected.rewardEndXds} XDS
                  </div>
                </div>
                <div className="readout-item">
                  <div className="readout-label">Regime at month end</div>
                  <div className="readout-value">
                    {selected.regimeAtEnd === "tail" ? "Tail emission" : "Base curve"}
                  </div>
                </div>
              </div>

              <details className="exact-table">
                <summary>View Year {selectedYear.year} monthly data</summary>
                <div className="table-wrap emission-table-wrap">
                  <table className="data-table emission-data-table">
                    <caption className="sr-only">
                      Exact XDS emission data for protocol Year {selectedYear.year}
                    </caption>
                    <thead>
                      <tr>
                        <th>Month / target dates</th>
                        <th>Exact blocks</th>
                        <th>Monthly flow · XDS</th>
                        <th>Treasury at month start · XDS</th>
                        <th>Cumulative totals · XDS</th>
                        <th>Reward · XDS / block</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedYear.months.map((row) => (
                        <tr key={row.globalMonth}>
                          <td data-label="Protocol month">
                            <span className="table-cell-stack month">
                              <strong>M{row.month}</strong>
                              <small>{row.period}</small>
                            </span>
                          </td>
                          <td data-label="Exact blocks">
                            <span className="table-cell-stack">
                              <strong>{formatInteger(row.blockStart)}–{formatInteger(row.blockEnd)}</strong>
                            </span>
                          </td>
                          <td data-label="Monthly flow · XDS">
                            <span className="table-cell-stack">
                              <strong>{formatNumber(row.minedXds)}</strong>
                              <small>Miner issuance</small>
                              <small
                                className="table-cell-accent"
                                data-active={Number(row.treasuryUnlockEnteringMonthXds) > 0}
                              >
                                + {formatNumber(row.treasuryUnlockEnteringMonthXds)} unlock
                              </small>
                              <small>= {formatAtoms(monthlyStackXds(row))} stacked</small>
                            </span>
                          </td>
                          <td data-label="Treasury at month start · XDS">
                            <span className="table-cell-stack">
                              <strong>{formatNumber(row.treasuryUnlockedStartXds)}</strong>
                              <small>Available</small>
                              <small>{formatAtoms(treasuryLockedAtMonthStartXds(row))} locked</small>
                            </span>
                          </td>
                          <td data-label="Cumulative totals · XDS">
                            <span className="table-cell-stack">
                              <strong>{formatAtoms(minedPlusAvailableAtMonthStartXds(row))}</strong>
                              <small>Mined + available</small>
                              <small>Consensus-generated supply: {formatNumber(row.totalSupplyXds)}</small>
                            </span>
                          </td>
                          <td data-label="Reward · XDS / block">
                            <span className="table-cell-stack">
                              <strong>{row.rewardStartXds} → {row.rewardEndXds}</strong>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </div>
          </div>
        </section>

        <TreasuryExplorer />

        <section className="section" id="mechanics">
          <div className="container">
            <div className="section-heading">
              <div>
                <p className="section-kicker">Consensus mechanics</p>
                <h2>The reward falls, bottoms out, then slowly rises.</h2>
              </div>
              <p className="section-intro">
                That shape is not an estimate. It is the direct result of comparing the
                declining base branch with a percentage-based tail branch at every block.
              </p>
            </div>

            <div className="mechanics-grid">
              <div>
                <div className="formula-card">
                  <div className="formula-head">
                    <span>Base reward · atomic units</span>
                    <span>1 XDS = 100 atoms</span>
                  </div>
                  <pre>{`reward = max(
  (2,100,000,000 − supply) >> 18,
  ((supply / 100) × 2) / 350,400
)`}</pre>
                </div>
                <p className="formula-note">
                  Every division truncates in integer atomic units. <strong>Supply already
                  includes the 1,050,000 XDS genesis reserve</strong>, which is why the
                  first miner reward is 76.10 XDS rather than a zero-supply result.
                </p>
              </div>

              <ol className="mechanic-steps">
                <li className="mechanic-step">
                  <span className="step-number">01</span>
                  <div>
                    <h3>Start at the real genesis supply</h3>
                    <p>Block zero creates 105,000,000 atoms before mining begins.</p>
                  </div>
                </li>
                <li className="mechanic-step">
                  <span className="step-number">02</span>
                  <div>
                    <h3>Evaluate both branches</h3>
                    <p>The node computes the declining reward and percentage tail, then uses the larger integer result.</p>
                  </div>
                </li>
                <li className="mechanic-step">
                  <span className="step-number">03</span>
                  <div>
                    <h3>Update supply, then repeat</h3>
                    <p>Each exact reward changes the supply used by the next block.</p>
                  </div>
                </li>
              </ol>
            </div>

            <aside className="truth-callout" aria-labelledby="tail-title">
              <p className="section-kicker">Tail-emission crossover</p>
              <h2 id="tail-title">The tail branch takes control in Protocol Year 4.</h2>
              <div className="transition-grid">
                <div>
                  <span>First equality</span>
                  <strong>Block 1,091,116</strong>
                  <p>Base = tail = 1.18 XDS · projected Sep 2, 2029</p>
                </div>
                <div>
                  <span>Permanent dominance</span>
                  <strong>Block 1,093,337</strong>
                  <p>Tail 1.18 &gt; base 1.17 XDS · projected Sep 5, 2029</p>
                </div>
              </div>
              <p>
                The 2,221-block equality window exists because rewards are truncated to
                atomic units. After block 1,093,337 the tail branch never gives control
                back. The reward bottoms near 1.18 XDS, then rises with supply—reaching
                1.35 XDS by block 3,504,000.
              </p>
              <p>
                The 1.18 XDS trough lasts through block 1,227,345. The reward first rises
                to 1.19 XDS at block 1,227,346, and generated supply crosses the 21M curve
                target later at block 1,354,404.
              </p>
              <p>
                <strong>21 million XDS is therefore not a hard cap.</strong> It is the
                target of the declining branch. Percentage-based issuance continues
                beyond it.
              </p>
            </aside>
          </div>
        </section>

        <section className="section split-section" id="sources">
          <div className="container method-grid">
            <div>
              <p className="section-kicker">Method and limits</p>
              <h2>Exact recurrence. Conditional path. Projected calendar.</h2>
              <p className="section-intro method-intro">
                The explorer runs through ten fixed 365-day protocol years—exactly
                3,504,000 modeled blocks on the unpenalized full-reward path. Dates are
                target-cadence projections, not calendar guarantees.
              </p>
              <dl className="method-list">
                <div className="method-item">
                  <dt>Horizon</dt>
                  <dd>Ten exact protocol years and 120 equal protocol months.</dd>
                </div>
                <div className="method-item">
                  <dt>Cadence</dt>
                  <dd>90-second target; 960 blocks per day; 350,400 per protocol year.</dd>
                </div>
                <div className="method-item">
                  <dt>Protocol month</dt>
                  <dd>29,200 blocks, or approximately 30.4167 target days.</dd>
                </div>
                <div className="method-item">
                  <dt>Precision and limits</dt>
                  <dd>
                    Atomic-unit arithmetic is exact for the stated path. Dates can drift;
                    block-size penalties can reduce emission and shift future milestones.
                  </dd>
                </div>
              </dl>
            </div>

            <aside className="sources-panel">
              <p className="section-kicker">Pinned source audit</p>
              <h3>Verified against consensus code</h3>
              <code className="commit">{sourceCommit}</code>
              <ul className="source-list">
                <li>
                  <a href={`${sourceRoot}/src/CryptoNoteConfig.h#L28-L88`} target="_blank" rel="noreferrer">
                    <span>Consensus parameters</span><span>Config ↗</span>
                  </a>
                </li>
                <li>
                  <a href={`${sourceRoot}/src/CryptoNoteCore/Currency.cpp#L170-L211`} target="_blank" rel="noreferrer">
                    <span>Block-reward implementation</span><span>Currency ↗</span>
                  </a>
                </li>
                <li>
                  <a href={`${sourceRoot}/src/CryptoNoteCore/GenesisTreasuryReserve.h#L25-L54`} target="_blank" rel="noreferrer">
                    <span>Treasury amount and unlock schedule</span><span>Reserve ↗</span>
                  </a>
                </li>
                <li>
                  <a href={`${sourceRoot}/src/CryptoNoteCore/Blockchain.cpp#L1135-L1154`} target="_blank" rel="noreferrer">
                    <span>Genesis supply accounting</span><span>Blockchain ↗</span>
                  </a>
                </li>
              </ul>
              <p className="disclaimer">
                Independent protocol research based on publicly available source code.
                Informational only; not investment advice.
              </p>
            </aside>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="container footer-inner">
          <span>Discrete XDS ten-year emission explorer · Calculated 2026-08-02</span>
          <span>
            Source: {sourceCommit.slice(0, 8)} ·{" "}
            <a href="https://github.com/discretecoin/discrete" target="_blank" rel="noreferrer">
              discretecoin/discrete ↗
            </a>
          </span>
        </div>
      </footer>
    </div>
  );
}

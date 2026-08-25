# XDS ten-year emission explorer

A static, code-derived explorer covering ten Discrete protocol years: 3,504,000
mining blocks split into 120 equal 29,200-block protocol months.

The dataset is generated and independently checked in integer atomic units:

- `npm run generate:emission` writes the 120-row JSON and CSV datasets;
- `npm run verify:emission` replays every modeled block and verifies the files;
- `npm test` builds the report and checks its rendered content and controls.

The chart defaults to a derived protocol-accounting subtotal:
`cumulative miner issuance + Treasury scheduled unlocked`. This deliberately
excludes Treasury outputs that remain time-locked. It is not a circulating-supply,
liquidity, ownership, or holder-balance estimate. The consensus-generated supply
counter remains available in the exact table and download; it includes the full
genesis reserve from block zero.

Each monthly bar is stacked from two distinct protocol flows: miner issuance and
the Treasury amount scheduled to unlock during that month. The initial 50,000 XDS
genesis-unlocked batch is the cumulative line's starting anchor, not a Month 1 bar
segment.

The emission chart keeps the monthly miner bars, scheduled-unlock caps, and one
selectable right-axis line: cumulative mined plus scheduled unlocked or block
reward. A separate Treasury chart uses independent Year 1–5 and month controls to
show the cumulative scheduled-unlocked share, the amount still time-locked by
consensus, and the exact 50,000 XDS unlock steps on a fixed 1.05M XDS scale.

Pinned reference results:

- `15,757,800.88 XDS` generated supply at block `350,400`;
- first base/tail equality at block `1,091,116`;
- permanent tail dominance at block `1,093,337`;
- minimum effective reward of `1.18 XDS` through block `1,227,345`;
- `21M` crossed at block `1,354,404` without stopping issuance;
- `23,729,945.64 XDS` generated supply at block `3,504,000`.

The GitHub Pages build uses a static export with the project base path
`/discrete-cash/xds-emission`.

The canonical explorer build uses `npm run explorer:build`, exports at
`/emission`, and sets metadata plus the brand-home link for
`https://explorer.discrete.cash/emission/`.

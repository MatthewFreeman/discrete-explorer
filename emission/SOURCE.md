# XDS Emission Explorer test preview

- Status: pre-PR test deployment; not the canonical Explorer artifact
- Source repository: https://github.com/MatthewFreeman/discrete-explorer
- Source branch: `xds-emission-source`
- Source commit: `bab42d78b3eeae87b5425a4699d4a8799c3e6726`
- Public route: `https://matthewfreeman.github.io/discrete-explorer/emission/`
- Build base path: `/discrete-explorer/emission`

The static export was built from a clean detached checkout of the source commit
with the committed npm lockfile. The deterministic Next build ID is the full
source commit, and `EXPORT-MANIFEST.sha256` records every generated payload file.

The emission model is pinned to Discrete consensus commit
`7311efa2775af3409e167e4fc1521b024c2d4d21`. Exact block ranges are authoritative;
projected dates assume the 90-second target cadence.

The canonical `discretecoin/discrete-explorer` repository and
`explorer.discrete.cash/emission/` deployment are not changed by this preview.

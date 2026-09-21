# XDS Emission Explorer test preview

- Status: pre-PR test deployment; not the canonical Explorer artifact
- Source repository: https://github.com/MatthewFreeman/discrete-explorer
- Source branch: `xds-emission-source`
- Source commit: `cc9567f702abb90656045899d72eaaad9e59d163`
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

# XDS emission explorer source

This static export was built from the immutable source commit:

https://github.com/MatthewFreeman/discrete-explorer/tree/c9e7cbdc76d71519b4d5dfa3ac51fb5844b17a04

Rebuild from that checkout with:

```text
npm ci
npm run explorer:build
```

The emission model is pinned to Discrete consensus commit
`7311efa2775af3409e167e4fc1521b024c2d4d21`. Exact block ranges are
authoritative; projected dates assume the 90-second target cadence.

The `Today` position reads the current chain height, generated supply, next
reward, and tip timestamp from the public Discrete Explorer RPC nodes. Treasury
availability is derived from the pinned consensus unlock schedule at that exact
height. The page keeps the code-derived model usable if both RPC nodes are
temporarily unavailable.

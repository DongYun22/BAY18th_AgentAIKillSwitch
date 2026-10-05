# K2 Plan · Wallet session

## Ready when

K1 merged.

## Branch

`ks/k2-wallet`

Worktree: `../ks-k2`

## Steps

1. Add `assertChain` and `shortAddress`. Checkpoint: K-T-2 passes without a browser.
2. Add `connect` and `watchAccount` behind a `WalletProvider` argument so tests can pass a fake EIP-1193 object. Checkpoint: a fake provider that returns one account resolves `connect`.
3. Wire the button in `main.ts`. Checkpoint: manual check on Sepolia and on one other chain.
4. Do not add log scans.

## Commands

```bash
cd app && npm test && npm run build
```

## Risks and fallbacks

- No injected wallet in CI. K-T-2 stays pure. The manual chain check is recorded in the PR text, not asserted in CI.

## Review focus

`assertChain` is the only chain gate. A later task must call it before any write.

## Time box

1.5 hours.

## Agent prompt

```text
Read docs/lane/working-rules.md, docs/lane/system.md, docs/lane/dictionary.md, docs/lane/quality.md, docs/lane/security.md, and this task's spec.md and plan.md.
Branch ks/k2-wallet. Worktree ../ks-k2.
You own only the files under Owns.
Implement the Spec in the Plan's order. Types, strings, versions, and calls come from the lane docs. If two pages disagree, write the BLOCKED line and stop.
Save this prompt as docs/prompts/K2.md.
Run the QC gate in docs/lane/quality.md and paste the output into the PR template.
```

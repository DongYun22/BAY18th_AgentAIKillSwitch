# K7 Plan · Permit2 standing allowance index

## Ready when

K4 merged. K1's `config.permit2` is present.

## Branch

`ks/k7-permit2`

Worktree: `../ks-k7`

## Steps

1. ABI for `Permit`, `Approval`, and `allowance`. Checkpoint: types compile.
2. Merge the two event streams by log order. Checkpoint: a later `Approval` replaces an earlier `Permit` for the same pair.
3. Apply amount and expiration filters. Checkpoint: K-T-7 passes.

## Commands

```bash
cd app && npm test
```

## Risks and fallbacks

- The Permit2 `Approval` event signature must match the deployed contract. If the test ABI's topic differs from a mainnet lookup, fix the ABI string in this task and add the source comment `AllowanceTransfer.sol Approval`. Do not point `config.permit2` at a different address.

## Review focus

Expiration uses the block timestamp, not `Date.now()`.

## Time box

2 hours.

## Agent prompt

```text
Read docs/lane/working-rules.md, docs/lane/system.md, docs/lane/dictionary.md, docs/lane/quality.md, docs/lane/security.md, and this task's spec.md and plan.md.
Branch ks/k7-permit2. Worktree ../ks-k7.
You own only the files under Owns.
Implement the Spec in the Plan's order. Types, strings, versions, and calls come from the lane docs. If two pages disagree, write the BLOCKED line and stop.
Save this prompt as docs/prompts/K7.md.
Run the QC gate in docs/lane/quality.md and paste the output into the PR template.
```

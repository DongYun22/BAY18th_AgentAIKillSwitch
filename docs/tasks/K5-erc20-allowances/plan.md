# K5 Plan · ERC-20 allowance index

## Ready when

K4 merged, because the caller passes K4's agent addresses. The function itself only needs `Address[]`.

## Branch

`ks/k5-erc20`

Worktree: `../ks-k5`

## Steps

1. Log decode and "latest log wins". Checkpoint: a unit test with two logs for one pair keeps the later one.
2. `allowance` confirmation and zero-drop. Checkpoint: K-T-5 passes.
3. Chunk the `getLogs` range. Checkpoint: a fake client that errors on a range larger than `logChunk` still returns rows.

## Commands

```bash
cd app && npm test
```

## Risks and fallbacks

- Some tokens lie in `Approval` logs and revert on `allowance`. Requirement 3 drops those rows.
- A public RPC may reject the unfiltered scan. Throw E-04. Do not switch to a token list.

## Review focus

The amount on screen will be the live `allowance`, so a spent allowance of 0 disappears.

## Time box

2 hours.

## Agent prompt

```text
Read docs/lane/working-rules.md, docs/lane/system.md, docs/lane/dictionary.md, docs/lane/quality.md, docs/lane/security.md, and this task's spec.md and plan.md.
Branch ks/k5-erc20. Worktree ../ks-k5.
You own only the files under Owns.
Implement the Spec in the Plan's order. Types, strings, versions, and calls come from the lane docs. If two pages disagree, write the BLOCKED line and stop.
Save this prompt as docs/prompts/K5.md.
Run the QC gate in docs/lane/quality.md and paste the output into the PR template.
```

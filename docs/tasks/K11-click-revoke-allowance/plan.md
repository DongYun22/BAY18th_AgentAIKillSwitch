# K11 Plan · Click revoke allowance

## Ready when

K2 and K9 merged. K10 may be in progress; do not change K10's permission button.

## Branch

`ks/k11-revoke-allowance`

Worktree: `../ks-k11`

## Steps

1. `canRevokeAllowance` and the `approve(spender, 0)` call builder. Checkpoint: K-T-11 encode test passes.
2. Render `Revoke` or `Needs the agent key`. Checkpoint: DOM assertion in K-T-11.
3. Wire the click. Checkpoint: the fake wallet records one send for the owner case and zero sends for the hot-key case.

## Commands

```bash
cd app && npm test && npm run build
```

## Risks and fallbacks

- Some tokens do not support `approve` to zero (the old race). If the receipt reverts, show `Revoke failed`. Do not retry with `approve(spender, 1)`.

## Review focus

The disabled copy is exactly `Needs the agent key`. That string is the product boundary for outside hot keys.

## Time box

1.5 hours.

## Agent prompt

```text
Read docs/lane/working-rules.md, docs/lane/system.md, docs/lane/dictionary.md, docs/lane/quality.md, docs/lane/security.md, and this task's spec.md and plan.md.
Branch ks/k11-revoke-allowance. Worktree ../ks-k11.
You own only the files under Owns.
Implement the Spec in the Plan's order. Types, strings, versions, and calls come from the lane docs. If two pages disagree, write the BLOCKED line and stop.
Save this prompt as docs/prompts/K11.md.
Run the QC gate in docs/lane/quality.md and paste the output into the PR template.
```

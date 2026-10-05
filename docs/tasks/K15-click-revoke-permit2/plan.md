# K15 Plan · Click revoke Permit2

## Ready when

K2 and K9 merged. Do not change the K11 or K14 buttons.

## Branch

`ks/k15-revoke-permit2`

Worktree: `../ks-k15`

## Steps

1. Encode Permit2 `approve(token, spender, 0, 0)`. Checkpoint: K-T-15 checks `to === config.permit2`.
2. Render D-14 or D-15. Checkpoint: the DOM assertion.
3. Wire the click through `assertChain`. Checkpoint: one send for the owner, zero sends otherwise.

## Commands

```bash
cd app && npm test && npm run build
```

## Risks and fallbacks

- A receipt with status 0 shows D-17. Do not call `lockdown` or `invalidateNonces` instead.

## Review focus

Both zero arguments are present. The target is Permit2.

## Time box

1.5 hours.

## Agent prompt

```text
Read docs/lane/working-rules.md, docs/lane/system.md, docs/lane/dictionary.md, docs/lane/quality.md, docs/lane/security.md, and this task's spec.md and plan.md.
Branch ks/k15-revoke-permit2. Worktree ../ks-k15.
You own only the files under Owns.
Implement the Spec in the Plan's order. Types, strings, versions, and calls come from the lane docs. If two pages disagree, write the BLOCKED line and stop.
Save this prompt as docs/prompts/K15.md.
Run the QC gate in docs/lane/quality.md and paste the output into the PR template.
```

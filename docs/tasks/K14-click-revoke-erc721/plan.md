# K14 Plan · Click revoke ERC-721 operator

## Ready when

K2 and K9 merged. Do not change the K11 ERC-20 button.

## Branch

`ks/k14-revoke-erc721`

Worktree: `../ks-k14`

## Steps

1. Encode `setApprovalForAll(operator, false)`. Checkpoint: K-T-14 encode case passes.
2. Render D-14 or D-15 on the operator line. Checkpoint: the DOM assertion in K-T-14.
3. Wire the click through `assertChain`. Checkpoint: one send for the owner, zero sends for the other account.

## Commands

```bash
cd app && npm test && npm run build
```

## Risks and fallbacks

- A receipt with status 0 shows D-17. Do not retry.

## Review focus

The disabled copy is D-15. The call's second argument is `false`.

## Time box

1.5 hours.

## Agent prompt

```text
Read docs/lane/working-rules.md, docs/lane/system.md, docs/lane/dictionary.md, docs/lane/quality.md, docs/lane/security.md, and this task's spec.md and plan.md.
Branch ks/k14-revoke-erc721. Worktree ../ks-k14.
You own only the files under Owns.
Implement the Spec in the Plan's order. Types, strings, versions, and calls come from the lane docs. If two pages disagree, write the BLOCKED line and stop.
Save this prompt as docs/prompts/K14.md.
Run the QC gate in docs/lane/quality.md and paste the output into the PR template.
```

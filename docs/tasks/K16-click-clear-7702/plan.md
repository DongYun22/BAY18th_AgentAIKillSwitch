# K16 Plan · Click clear EIP-7702

## Ready when

K2, K8, and K9 merged. Do not change K11, K14, or K15.

## Branch

`ks/k16-clear-7702`

Worktree: `../ks-k16`

## Steps

1. Build the authorization and the transaction from system §8 against a fake wallet. Checkpoint: K-T-16 passes, including zero calls to `signAuthorization` for the other account.
2. Render D-14 or D-15 on the delegation line.
3. Run K-T-13. Checkpoint: it passes because `signAuthorization` is only in `app/src/revoke/delegation7702.ts`.

## Commands

```bash
cd app && npm test && npm run build
```

## Risks and fallbacks

- The injected wallet has no `signAuthorization`. Show D-17. Do not fall back to `eth_sign` or a pasted key.

## Review focus

`contractAddress` is the zero address. `to` is the connected account, not `config.agentWallet`.

## Time box

2 hours.

## Agent prompt

```text
Read docs/lane/working-rules.md, docs/lane/system.md, docs/lane/dictionary.md, docs/lane/quality.md, docs/lane/security.md, and this task's spec.md and plan.md.
Branch ks/k16-clear-7702. Worktree ../ks-k16.
You own only the files under Owns.
Implement the Spec in the Plan's order. Types, strings, versions, and calls come from the lane docs. If two pages disagree, write the BLOCKED line and stop.
Save this prompt as docs/prompts/K16.md.
Run the QC gate in docs/lane/quality.md and paste the output into the PR template.
```

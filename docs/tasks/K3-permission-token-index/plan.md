# K3 Plan · PermissionToken index

## Ready when

K1 merged. A `VITE_FROM_BLOCK` value is known for manual runs. Tests do not need it.

## Branch

`ks/k3-permission-index`

Worktree: `../ks-k3`

## Steps

1. Add the ABI file. Checkpoint: `tsc` accepts the event types.
2. Add the log walker with `logChunk`. Checkpoint: a fake client that returns two chunks is fully consumed.
3. Add the `_canManage` filter and status rules. Checkpoint: K-T-3 passes.
4. Do not import `wallet.ts` and do not render HTML.

## Commands

```bash
cd app && npm test
```

## Risks and fallbacks

- Public RPCs cap `eth_getLogs`. `logChunk` is 50_000. If a run returns a range error, lower `logChunk` in config only, not the filter rules.
- `getPolicy` on a burned token may revert. Call it only after `ownerOf` succeeds. On `REVOKED`, keep `spendingLimit` and `expiry` from the mint log and set `allowlist` to `[]`.

## Review focus

The filter matches `_canManage` in `PermissionToken.sol`. A child whose parent burned is absent, not shown as active.

## Time box

2.5 hours.

## Agent prompt

```text
Read docs/lane/working-rules.md, docs/lane/system.md, docs/lane/dictionary.md, docs/lane/quality.md, docs/lane/security.md, and this task's spec.md and plan.md.
Branch ks/k3-permission-index. Worktree ../ks-k3.
You own only the files under Owns.
Implement the Spec in the Plan's order. Types, strings, versions, and calls come from the lane docs. If two pages disagree, write the BLOCKED line and stop.
Save this prompt as docs/prompts/K3.md.
Run the QC gate in docs/lane/quality.md and paste the output into the PR template.
```

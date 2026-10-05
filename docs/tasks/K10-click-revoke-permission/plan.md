# K10 Plan · Click revoke PermissionToken

## Ready when

K2 and K9 merged.

## Branch

`ks/k10-revoke-permission`

Worktree: `../ks-k10`

## Steps

1. `canRevokePermission` and the call-data builder. Checkpoint: K-T-10 passes with a fake wallet.
2. Add the button in `render.ts` without sending. Checkpoint: the DOM test shows a button only for the allowed row.
3. Wire the click to `revokePermission` and reload. Checkpoint: `npm run build`.
4. Re-check `assertChain` is called inside `revokePermission`, not only in the UI.

## Commands

```bash
cd app && npm test && npm run build
```

## Risks and fallbacks

- `ownerOf` on a burned parent throws. Treat that as `parentOwner = null`, so `canRevokePermission` is false. Do not offer a button.

## Review focus

The Hot Agent address never gets a button for its own child token. K-T-10 includes that case (parent owner is not the connected account).

## Time box

2 hours.

## Agent prompt

```text
Read docs/lane/working-rules.md, docs/lane/system.md, docs/lane/dictionary.md, docs/lane/quality.md, docs/lane/security.md, and this task's spec.md and plan.md.
Branch ks/k10-revoke-permission. Worktree ../ks-k10.
You own only the files under Owns.
Implement the Spec in the Plan's order. Types, strings, versions, and calls come from the lane docs. If two pages disagree, write the BLOCKED line and stop.
Save this prompt as docs/prompts/K10.md.
Run the QC gate in docs/lane/quality.md and paste the output into the PR template.
```

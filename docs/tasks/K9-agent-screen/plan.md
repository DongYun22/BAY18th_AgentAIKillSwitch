# K9 Plan · Agent screen

## Ready when

K2, K4, K5, K6, K7, and K8 merged.

## Branch

`ks/k9-screen`

Worktree: `../ks-k9`

## Steps

1. `renderAgents` and K-T-9 with fixture data, no RPC. Checkpoint: K-T-9 passes.
2. `toScreen` in `render.ts`, system §7. Checkpoint: an allowance whose owner is neither `cold` nor a group agent is dropped.
3. Call the indexes from `main.ts` after connect. Checkpoint: `npm run build` exits 0.
4. Confirm the HTML has no `Revoke` button. A test in K-T-9 asserts `root.querySelectorAll('button').length === 0`.

## Commands

```bash
cd app && npm test && npm run build
```

## Risks and fallbacks

- Five log scans on connect can be slow. Run them with `Promise.all` after K3 and K4. Do not merge the scans into one new indexer in this task.

## Review focus

The empty copy is exactly `No agents for this account` and `none`. K-T-9 checks those strings.

## Time box

2 hours.

## Agent prompt

```text
Read docs/lane/working-rules.md, docs/lane/system.md, docs/lane/dictionary.md, docs/lane/quality.md, docs/lane/security.md, and this task's spec.md and plan.md.
Branch ks/k9-screen. Worktree ../ks-k9.
You own only the files under Owns.
Implement the Spec in the Plan's order. Types, strings, versions, and calls come from the lane docs. If two pages disagree, write the BLOCKED line and stop.
Save this prompt as docs/prompts/K9.md.
Run the QC gate in docs/lane/quality.md and paste the output into the PR template.
```

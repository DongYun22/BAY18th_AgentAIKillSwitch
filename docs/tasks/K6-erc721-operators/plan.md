# K6 Plan · ERC-721 operator index

## Ready when

K4 merged. Inline the log loop from system §5. Do not create `app/src/index/logs.ts`. Do not edit K5's files.

## Branch

`ks/k6-erc721`

Worktree: `../ks-k6`

## Steps

1. Decode `ApprovalForAll` and keep the latest log. Checkpoint: two logs, the later flag wins before the live call.
2. Confirm with `isApprovedForAll`. Checkpoint: K-T-6 passes.

## Commands

```bash
cd app && npm test
```

## Risks and fallbacks

- Same RPC range limit as K5. Use `config.logChunk`.

## Review focus

A log that says `approved=true` is not enough. The live call decides.

## Time box

1.5 hours.

## Agent prompt

```text
Read docs/lane/working-rules.md, docs/lane/system.md, docs/lane/dictionary.md, docs/lane/quality.md, docs/lane/security.md, and this task's spec.md and plan.md.
Branch ks/k6-erc721. Worktree ../ks-k6.
You own only the files under Owns.
Implement the Spec in the Plan's order. Types, strings, versions, and calls come from the lane docs. If two pages disagree, write the BLOCKED line and stop.
Save this prompt as docs/prompts/K6.md.
Run the QC gate in docs/lane/quality.md and paste the output into the PR template.
```

# K13 Plan · Index boundary

## Ready when

K1 merged, so `app/src` exists. K13 can land before the index tasks. It must still pass after they land.

## Branch

`ks/k13-boundary`

Worktree: `../ks-k13`

## Steps

1. Add `boundary.test.ts` with the three string checks and the import check. Checkpoint: `npm test` passes on current `app/src`.
2. Temporarily insert `wallet_revokeExecutionPermission` in `main.ts`, run the test, confirm failure, and revert that insertion before commit.
3. Do not add allow-comments. The strings are forbidden, not allowlisted.

## Commands

```bash
cd app && npm test
```

## Risks and fallbacks

- A comment that names the forbidden RPC in documentation under `app/src` fails the test. Put that explanation in `docs/`, not in `app/src`.

## Review focus

The test scans source text, not the built bundle. Minified output is out of scope.

## Time box

1 hour.

## Agent prompt

```text
Read docs/lane/working-rules.md, docs/lane/system.md, docs/lane/dictionary.md, docs/lane/quality.md, docs/lane/security.md, and this task's spec.md and plan.md.
Branch ks/k13-boundary. Worktree ../ks-k13.
You own only the files under Owns.
Implement the Spec in the Plan's order. Types, strings, versions, and calls come from the lane docs. If two pages disagree, write the BLOCKED line and stop.
Save this prompt as docs/prompts/K13.md.
Run the QC gate in docs/lane/quality.md and paste the output into the PR template.
```

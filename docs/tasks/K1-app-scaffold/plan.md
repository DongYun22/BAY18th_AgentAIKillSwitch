# K1 Plan · App scaffold

## Ready when

Nothing. K1 does not wait on K0.

## Branch

`ks/k1-scaffold`

Worktree: `../ks-k1`

## Steps

1. Add `app/package.json` with the versions and scripts in system §1. No `^` and no `~`. Checkpoint: `npm install` in `app/`.
2. Add `config.ts` with `readFromBlock` and the addresses in the Spec. Checkpoint: K-T-1 passes.
3. Add Vite, `index.html`, and `main.ts` that only writes `Kill-switch`. Checkpoint: `npm run build` exits 0.
4. Diff `dashboard/` and confirm it is empty.

## Commands

```bash
cd app
npm test
npm run build
```

## Risks and fallbacks

- `import.meta.env` is awkward to unit test. Test `readFromBlock`, not the Vite env object.

## Review focus

`config` has exactly the fields in Requirement 2. `viem` is the only runtime dependency besides Vite's own packages.

## Time box

1.5 hours.

## Agent prompt

```text
Read docs/lane/working-rules.md, docs/lane/system.md, docs/lane/dictionary.md, docs/lane/quality.md, docs/lane/security.md, and this task's spec.md and plan.md.
Branch ks/k1-scaffold. Worktree ../ks-k1.
You own only the files under Owns.
Implement the Spec in the Plan's order. Types, strings, versions, and calls come from the lane docs. If two pages disagree, write the BLOCKED line and stop.
Save this prompt as docs/prompts/K1.md.
Run the QC gate in docs/lane/quality.md and paste the output into the PR template.
```

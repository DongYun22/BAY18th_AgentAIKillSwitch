# K4 Plan · Agent groups

## Ready when

K3 merged.

## Branch

`ks/k4-agent-groups`

Worktree: `../ks-k4`

## Steps

1. Add `AgentGroup` and `groupAgents`. Checkpoint: K-T-4 passes.
2. Export the type from `app/src/index/agents.ts` only. Do not re-export it from a barrel that pulls in RPC code.

## Commands

```bash
cd app && npm test
```

## Risks and fallbacks

- A root minted to an address that is not `cold` never appears, because K3 already filtered it. Do not add a second filter that drops child tokens held by `cold` if a future mint does that. Requirement 3 drops only `parentId === 0n`.

## Review focus

The root token is visible to K9 later as context, but K4's return value is agents only. K9 may call K3 again for the root; this task does not render it.

## Time box

1 hour.

## Agent prompt

```text
Read docs/lane/working-rules.md, docs/lane/system.md, docs/lane/dictionary.md, docs/lane/quality.md, docs/lane/security.md, and this task's spec.md and plan.md.
Branch ks/k4-agent-groups. Worktree ../ks-k4.
You own only the files under Owns.
Implement the Spec in the Plan's order. Types, strings, versions, and calls come from the lane docs. If two pages disagree, write the BLOCKED line and stop.
Save this prompt as docs/prompts/K4.md.
Run the QC gate in docs/lane/quality.md and paste the output into the PR template.
```

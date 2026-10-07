# K8 Plan · EIP-7702 code read

## Ready when

K4 merged, so the caller has agent addresses. The parser itself has no dependency.

## Branch

`ks/k8-7702`

Worktree: `../ks-k8`

## Steps

1. `readDelegation` plus K-T-8. Checkpoint: the four cases pass with no RPC.
2. `indexDelegations` over a fake client whose `getCode` map is fixed. Checkpoint: one delegated agent and one empty-code agent return a one-element list.

## Commands

```bash
cd app && npm test
```

## Risks and fallbacks

- Some RPCs return code without the `0x` prefix. Normalize by requiring `Hex` from viem before `readDelegation`. Do not accept a second prefix.

## Review focus

The function does not treat the implementation address as a session-key list. Session keys stay out of this task.

## Time box

1 hour.

## Agent prompt

```text
Read docs/lane/working-rules.md, docs/lane/system.md, docs/lane/dictionary.md, docs/lane/quality.md, docs/lane/security.md, and this task's spec.md and plan.md.
Branch ks/k8-7702. Worktree ../ks-k8.
You own only the files under Owns.
Implement the Spec in the Plan's order. Types, strings, versions, and calls come from the lane docs. If two pages disagree, write the BLOCKED line and stop.
Save this prompt as docs/prompts/K8.md.
Run the QC gate in docs/lane/quality.md and paste the output into the PR template.
```

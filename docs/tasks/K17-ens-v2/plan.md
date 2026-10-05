# K17 Plan · ENSv2 role index

## Ready when

A human has written `docs/decisions/ens-v2.md` with `Status: decided`, a `Registry` address, and an `Assignee event` signature. Until then this plan is one step: stop.

## Branch

`ks/k17-ens-v2`

Worktree: `../ks-k17`

## Steps

1. Read `docs/decisions/ens-v2.md`. If Requirement 1 of the Spec applies, change no file and do not open the branch.
2. Index only the pinned event on the pinned registry. Checkpoint: a fixture log for a different registry is absent.
3. Wire D-19 to `revokeRoles` with the three arguments from that log. Checkpoint: the fake wallet records one send for the admin and zero sends for another account.

## Commands

```bash
cd app && npm test && npm run build
```

## Risks and fallbacks

- `TokenRegenerated` does not by itself name the account that received the role. If the pinned event does not include the account, the resource, and the role bitmap, stop with BLOCKED. Do not decode a token id.

## Review focus

No registry address appears in the diff unless it is copied from the decision file.

## Time box

2 hours after the decision. 10 minutes if blocked.

## Agent prompt

```text
Read docs/lane/working-rules.md, docs/lane/system.md, docs/lane/dictionary.md, docs/lane/quality.md, docs/lane/security.md, and docs/tasks/K17-ens-v2/spec.md and plan.md.
If docs/decisions/ens-v2.md is missing or not decided, change no file and reply "K17 blocked".
Do not invent a registry address or an event. If you implement, branch ks/k17-ens-v2, worktree ../ks-k17, and own only the files under Owns.
Save this prompt as docs/prompts/K17.md.
Run the QC gate in docs/lane/quality.md and paste the output into the PR template.
```

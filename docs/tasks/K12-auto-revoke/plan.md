# K12 Plan · Watcher auto-revoke

## Ready when

K0 has `Status: decided` and `Choice: permission-token`, and K5's allowance rules are merged so the "live allowance" check matches K5. If K0 is not that choice, this plan is one step long: stop.

## Branch

`ks/k12-watcher`

Worktree: `../ks-k12`

## Steps

1. Read `docs/decisions/framework-account.md`. If system §9 says stop, change no file, print W-02 or W-03, and do not open the branch.
2. Add `clearErc20Allowance` exactly as system §9. Checkpoint: `AgentWalletClear.t.sol` passes. Do not edit `PermissionToken.sol`.
3. Add the watcher scan from system §9. Checkpoint: K-T-12 passes and the failed-execute case still queues `revoke`.

## Commands

```bash
cd contracts && forge test --match-path test/AgentWalletClear.t.sol
cd agent-scripts && node --test watcher.test.mjs
```

## Risks and fallbacks

- The watcher has no test runner in `package.json`. Use `node --test`. Do not add a second framework.
- An allowance owned by `state.hotAgent` prints W-01 and sends nothing. Do not send `approve` from the Cold key to get past that.

## Review focus

No branch and no diff when system §9 says stop. `PermissionToken.sol` has no diff on the implement path either.

## Time box

3 hours after the decision. 10 minutes if blocked.

## Agent prompt

```text
Read docs/lane/working-rules.md, docs/lane/system.md, docs/lane/dictionary.md, docs/lane/quality.md, docs/lane/security.md, and this task's spec.md and plan.md.
Branch ks/k12-watcher. Worktree ../ks-k12.
You own only the files under Owns.
Implement the Spec in the Plan's order. Types, strings, versions, and calls come from the lane docs. If two pages disagree, write the BLOCKED line and stop.
Save this prompt as docs/prompts/K12.md.
Run the QC gate in docs/lane/quality.md and paste the output into the PR template.
```

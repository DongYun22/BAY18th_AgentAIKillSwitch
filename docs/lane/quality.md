# Quality gates

## QC gate

Every app task runs, from `app/`:

```bash
npm test
npm run build
```

`npm test` is `vitest run`. The test names in §2 are present. `npm run build` exits 0.

`git diff -- dashboard/index.html` is empty.

`app/package.json` has no `^` and no `~` on the packages in system §1.

K12, when and only when system §9 says to write code, also runs:

```bash
cd contracts && forge test --match-path test/AgentWalletClear.t.sol
cd agent-scripts && node --test watcher.test.mjs
```

K13's negative check is part of K-T-13. The agent inserts the forbidden string, watches the test fail, then removes it before commit. The committed tree does not contain that insertion.

## Test catalogue

| Test | Task | Proves |
|---|---|---|
| K-T-1 | K1 | `readFromBlock('100')` is `100`. `undefined` and `'0x10'` throw E-01 |
| K-T-2 | K2 | `assertChain(11155111)` returns. `assertChain(1)` throws E-02. `shortAddress('0xB6AF02FeEA21e2960A7C14FAf97bAdbE2E982836')` is `0xB6AF…2836` |
| K-T-3 | K3 | root, child, other parent, `REVOKED`, `EXPIRED`, `FROZEN` from fixture logs |
| K-T-4 | K4 | two agent groups, Cold is not a group, the root is in `roots` |
| K-T-5 | K5 | live amount kept, zero dropped, two tokens, other owner dropped |
| K-T-6 | K6 | live `true` kept, live `false` dropped, other owner dropped |
| K-T-7 | K7 | amount and future expiration kept, zero dropped, expiration equal to the block timestamp dropped |
| K-T-8 | K8 | the four `readDelegation` cases in the K8 Spec |
| K-T-9 | K9 | one agent block shows the address, `ACTIVE`, and the spender. An ERC-20 row whose owner is not the connected account shows D-18 and D-20. `[]` shows D-13 |
| K-T-10 | K10 | the four `canRevokePermission` cases, encoded `revoke`, zero sends when the check is false. A child row that A can revoke is labeled D-19. A root row that A can revoke is labeled D-14 |
| K-T-11 | K11 | owner encodes `approve(spender, 0)`. Other owner shows D-18 and D-20 and the small-call send count is 0. When that owner has a child token A can revoke, the row also shows D-19 |
| K-T-12 | K12 | wallet-owned allowance queues `clearErc20Allowance`. Hot-EOA allowance queues nothing and logs W-01. Failed execute still queues `revoke` |
| K-T-13 | K13 | forbidden strings and a `dashboard/index.html` import fail the scan |
| K-T-14 | K14 | owner encodes `setApprovalForAll(operator, false)`. Other owner shows D-18 and D-20 and the small-call send count is 0. When that owner has a child token A can revoke, the row also shows D-19 |
| K-T-15 | K15 | owner encodes Permit2 `approve(token, spender, 0, 0)`. Other owner shows D-18 and D-20 and the small-call send count is 0. When that owner has a child token A can revoke, the row also shows D-19 |
| K-T-16 | K16 | matching agent encodes `signAuthorization` to the zero address and `sendTransaction` to self. Other account shows D-18 and D-20 and does not call `signAuthorization`. When that account has a child token A can revoke, the row also shows D-19 |
| K-T-17 | K17 | an active `EACRolesChanged` row on the pinned registry is kept. A later zero bitmap and a different registry are dropped. The admin encodes `revokeRoles`. A non-admin sends nothing. Resource 0 encodes `revokeRootRoles` |

## Review checklist

The review fails the PR when any line is true:

- A path outside Owns changed.
- A user-facing string is not in the dictionary.
- A type field is not in system §3.
- A dependency version is not in system §1.
- A write in `app/` skipped `assertChain(11155111)`.
- `dashboard/index.html` changed.
- The prompt file `docs/prompts/<ID>.md` is missing.

## PR template

```text
Task: <ID>
Spec sections: <requirement numbers>
Acceptance output:
<pasted command output>
QC: npm test, npm run build, dashboard diff empty
Deviations: none
Prompt: docs/prompts/<ID>.md
```

`Deviations` is `none`. Anything else is a BLOCKED line, not a PR.

## Severity

| Level | Meaning |
|---|---|
| S1 | A write can fire when the check is false, or a key is committed |
| S2 | A row's status, amount, or owner is wrong |
| S3 | Copy or sort order differs from the dictionary or system §6 |
| S4 | A name or comment differs and the behavior matches |

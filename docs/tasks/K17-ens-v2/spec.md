# K17 Spec · ENSv2 role index

## Goal

Show ENSv2 roles that wallet A granted to an agent, and let A revoke that role. Do not implement the scan until a human pins the registry and the assignee log.

## Source of truth

[docs/architecture.md](../../architecture.md) "ENSv2 role" and "Revoke sizes". [docs/lane/dictionary.md](../../lane/dictionary.md) D-19. A disagreement is BLOCKED.

## Owns

While `docs/decisions/ens-v2.md` is missing: no file.

After a human writes that file with `Status: decided`, `Registry`, and `Assignee event`:

- `app/src/index/ensV2.ts`
- `app/src/index/ensV2.test.ts`
- `app/src/revoke/ensV2.ts`
- `app/src/revoke/ensV2.test.ts`

## Requirements

1. Before any edit, read `docs/decisions/ens-v2.md`. If the file is missing, or `Status` is not `decided`, or `Registry` is empty, or `Assignee event` is empty, change no file. Stop. Print `K17 blocked`.
2. Do not invent a registry address. Do not invent an event signature. Do not decode an ERC-1155 token id into a role bitmap.
3. When the file is decided, the revoke call is `revokeRoles(uint256 resource, uint256 roleBitmap, address account)` on `Registry`, after `assertChain(11155111)`. Resource 0 sends `revokeRootRoles(uint256 roleBitmap, address account)` because `revokeRoles` reverts on `ROOT_RESOURCE`. Send it only when the connected address is the admin in that file's rule. The button label is D-19.
4. `revokeRoles` does not call `approve`. A role revoke does not clear the agent's token allowances. The approval row still shows D-18 and D-20.
5. There is no K-T-17 until Requirement 1 passes. A blocked run has an empty diff.

## Security

The decision file contains no private key. The app does not send `revokeRoles` to an address that the decision file does not name.

## Acceptance

- While the decision file is open, the diff is empty and the report is `K17 blocked`.
- While it is decided, the encoded call is `revokeRoles` to the pinned registry, and a non-admin sends nothing.

## Out of scope

Naming the registry. Indexing text records `auth.credential`, `auth.capability`, or `auth.revocation`. Those records are not this task.

# K3 Spec · PermissionToken index

## Goal

Given the connected address, return every `PermissionToken` that address issued: roots it holds, and child tokens whose parent it owns.

## Source of truth

[docs/lane/system.md](../../lane/system.md) §3 and §4. Event and views in [`PermissionToken.sol`](../../../contracts/src/PermissionToken.sol). A disagreement is BLOCKED.

## Owns

- `app/src/index/permissionToken.ts`
- `app/src/index/permissionToken.test.ts`
- `app/src/abi/permissionToken.ts`

## Requirements

1. The ABI includes `PermissionMinted(uint256 indexed tokenId, address indexed to, uint256 indexed parentId, uint256 spendingLimit, uint64 expiry)`, `getPolicy(uint256)`, `isValid(uint256)`, `ownerOf(uint256)`, `parentTokenId(uint256)`, `frozen(uint256)`.
2. `indexPermissions(client, cold: Address): Promise<PermissionRow[]>` scans `PermissionMinted` on `config.permissionToken` from `config.fromBlock` to `latest` in steps of `config.logChunk`.
3. A log enters the result only when `cold` can manage that token, matching `_canManage`: `parentId == 0` and `to == cold`, or `parentId != 0` and `ownerOf(parentId) == cold`. A burned parent (`ownerOf` revert) drops the child.
4. Each `PermissionRow` is `{ tokenId: bigint, holder: Address, parentId: bigint, spendingLimit: bigint, allowlist: Address[], expiry: bigint, status: 'ACTIVE' | 'FROZEN' | 'REVOKED' | 'EXPIRED' }`. `holder` is the log's `to`. `allowlist` and the live limit come from `getPolicy`.
5. Status is system §4, in that order. The timestamp is the `latest` block's timestamp. On `REVOKED`, `getPolicy` still supplies `spendingLimit`, `allowlist`, and `expiry`.
6. `permissionToken.test.ts` is named `K-T-3`. It feeds fixture logs, not a live RPC:
   - cold mints root token 1 to self: one `ACTIVE` row, holder is cold.
   - cold mints child token 2 to `0x67f49213ae30080250467bbc2fc9495f9c58dca8`: one row, holder is that address, parentId 1.
   - a mint whose parent owner is a different address is absent.
   - `ownerOf` revert on the child yields `REVOKED`, and the row keeps the `getPolicy` spending limit.
   - `expiry` equal to the block timestamp yields `EXPIRED` even when `frozen` is true.
   - `expiry` in the future and `isValid` false yields `FROZEN`.

## Security

This task only reads. It does not sign `revoke`.

## Acceptance

- `npm test` green, K-T-3 present by name.
- No write method is called in `permissionToken.ts` (`revoke`, `freeze`, `mintChild`, `mintRoot` are absent from the call list).

## Out of scope

Grouping by agent (K4). The screen (K9). The click (K10).

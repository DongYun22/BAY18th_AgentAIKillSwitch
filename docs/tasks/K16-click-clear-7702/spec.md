# K16 Spec · Click clear EIP-7702

## Goal

The connected wallet clears its own EIP-7702 delegation. Another account's delegation is shown and is not signed here.

## Source of truth

[docs/lane/system.md](../../lane/system.md) §8, the K16 row. [docs/lane/dictionary.md](../../lane/dictionary.md) D-14, D-18, D-19, and D-20. [docs/lane/security.md](../../lane/security.md) allows `signAuthorization` only in this task's file. A disagreement is BLOCKED.

## Owns

- `app/src/revoke/delegation7702.ts`
- `app/src/revoke/delegation7702.test.ts`
- `app/src/view/render.ts` (the delegation line only)

## Requirements

1. `canClearDelegation` and `clearDelegation` are the K16 row in system §8. `contractAddress` is `0x0000000000000000000000000000000000000000`. `to` is the connected address. `data` is `0x`. `value` is `0n`.
2. A true check shows D-14. A false check shows D-18 then D-20, does not show D-14, and does not call `signAuthorization`. When `row.agent` equals an agent group and `canRevokePermission` is true for a child token in that group, the same row also shows button D-19. That button calls `revokePermission` for that child, the lowest `tokenId` when more than one child qualifies. If none qualifies, the row has no D-19.
3. `delegation7702.test.ts` is named `K-T-16`, with the cases in quality.md. A false check throws E-03.
4. A missing `signAuthorization` on the wallet shows D-17. Do not ask for a key and do not build the authorization another way.

## Security

security.md Writes and Forbidden. This is the only `app/src` file that contains `signAuthorization`.

## Acceptance

- K-T-16 passes by name.
- K-T-13 still passes.

## Out of scope

Session keys inside the implementation. Installing a new delegation to a non-zero address.

# K14 Spec · Click revoke ERC-721 operator

## Goal

The connected wallet clears an ERC-721 operator approval only when it is that approval's owner.

## Source of truth

[docs/lane/system.md](../../lane/system.md) §8, the K14 row. [docs/lane/dictionary.md](../../lane/dictionary.md) D-14, D-18, D-19, and D-20. A disagreement is BLOCKED.

## Owns

- `app/src/revoke/erc721.ts`
- `app/src/revoke/erc721.test.ts`
- `app/src/view/render.ts` (the operator row only)

## Requirements

1. `canRevokeErc721` and `revokeErc721` are the K14 row in system §8.
2. A true check shows D-14. A false check shows D-18 then D-20, does not show D-14, and does not send `setApprovalForAll`. When the row owner equals an agent group and `canRevokePermission` is true for a child token in that group, the same row also shows button D-19. That button calls `revokePermission` for that child, the lowest `tokenId` when more than one child qualifies. If none qualifies, the row has no D-19.
3. `erc721.test.ts` is named `K-T-14`, with the cases in quality.md. Calling `revokeErc721` when the check is false throws E-03, and the `setApprovalForAll` send count stays 0.

## Security

[docs/lane/security.md](../../lane/security.md) Writes. No key input.

## Acceptance

- K-T-14 passes by name.
- ERC-20, Permit2, and delegation rows are unchanged by this task.

## Out of scope

Single-token ERC-721 `approve`. ERC-1155. K11, K15, K16.

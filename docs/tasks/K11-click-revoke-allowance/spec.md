# K11 Spec · Click revoke allowance

## Goal

The connected wallet can set an ERC-20 allowance to zero only when it is the allowance owner. An agent hot key's allowance is shown and cannot be revoked from this wallet.

## Source of truth

[docs/lane/system.md](../../lane/system.md) §8, the K11 row. [docs/lane/dictionary.md](../../lane/dictionary.md) D-14, D-18, D-19, and D-20. [docs/architecture.md](../../architecture.md) "Revoke sizes". A disagreement is BLOCKED.

## Owns

- `app/src/revoke/erc20.ts`
- `app/src/revoke/erc20.test.ts`
- `app/src/view/render.ts` (the ERC-20 row button only)

## Requirements

1. The check and the call are the K11 row in system §8.
2. A true check shows button D-14. A false check shows D-18 then D-20, does not show D-14, and does not send `approve`. When the row owner equals an agent group and `canRevokePermission` is true for a child token in that group, the same row also shows button D-19. That button calls `revokePermission` for that child, the lowest `tokenId` when more than one child qualifies. If none qualifies, the row has no D-19.
3. ERC-721, Permit2, and EIP-7702 rows get no button in this task. Those buttons are K14, K15, and K16.
4. `erc20.test.ts` is named `K-T-11`, with the cases in quality.md. Calling `revokeErc20` when the check is false throws E-03 before send, and the `approve` send count stays 0.

## Security

The app does not ask for the hot key. A disabled row is not a prompt to paste a key.

## Acceptance

- K-T-11 passes by name.
- The fake wallet's `approve` send count stays 0 when `canRevokeErc20` is false.

## Out of scope

ERC-721 (K14). Permit2 (K15). EIP-7702 (K16). Watcher auto-revoke (K12).

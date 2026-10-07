# K15 Spec · Click revoke Permit2

## Goal

The connected wallet sets a Permit2 standing allowance to zero only when it is that allowance's owner.

## Source of truth

[docs/lane/system.md](../../lane/system.md) §8, the K15 row. [docs/lane/dictionary.md](../../lane/dictionary.md) D-14, D-18, D-19, and D-20. A disagreement is BLOCKED.

## Owns

- `app/src/revoke/permit2.ts`
- `app/src/revoke/permit2.test.ts`
- `app/src/view/render.ts` (the Permit2 row only)

## Requirements

1. `canRevokePermit2` and `revokePermit2` are the K15 row in system §8. The call target is `config.permit2`. Arguments are `(token, spender, 0, 0)`.
2. A true check shows D-14. A false check shows D-18 then D-20, does not show D-14, and does not send Permit2 `approve`. When the row owner equals an agent group and `canRevokePermission` is true for a child token in that group, the same row also shows button D-19. That button calls `revokePermission` for that child, the lowest `tokenId` when more than one child qualifies. If none qualifies, the row has no D-19.
3. `permit2.test.ts` is named `K-T-15`, with the cases in quality.md. Calling `revokePermit2` when the check is false throws E-03, and the Permit2 `approve` send count stays 0.

## Security

[docs/lane/security.md](../../lane/security.md) Writes. No key input.

## Acceptance

- K-T-15 passes by name.
- The encoded `to` is `config.permit2`, not the underlying token.

## Out of scope

Permit2 `SignatureTransfer`. EIP-2612. K11, K14, K16.

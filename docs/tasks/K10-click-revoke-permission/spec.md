# K10 Spec · Click revoke PermissionToken

## Goal

The connected wallet can revoke a child or root token it is allowed to manage. The Hot Agent address cannot.

## Source of truth

[docs/lane/system.md](../../lane/system.md) §8, the K10 row. [docs/lane/dictionary.md](../../lane/dictionary.md) D-14 and D-17. A disagreement is BLOCKED.

## Owns

- `app/src/revoke/permissionToken.ts`
- `app/src/revoke/permissionToken.test.ts`
- `app/src/view/render.ts` (one button per permission row)

## Requirements

1. `canRevokePermission` and `parentOwner` are system §8.
2. `revokePermission` sends the K10 call in system §8.
3. A child permission line A can revoke gains button D-19. A root line A can revoke gains button D-14. A line A cannot revoke gains no button. There is no confirm dialog. A receipt with status 0, or a wallet rejection, prepends D-17 and does not clear the previous render. D-19 and D-14 both call `revokePermission`. Neither call sends `approve`.
4. `permissionToken.test.ts` is named `K-T-10`. Cases are quality.md K-T-10. The fake wallet does not broadcast.

## Security

The button is hidden when `canRevokePermission` is false. The send function still re-checks `canRevokePermission` and throws `Not allowed` instead of sending. No private key is added to the app.

## Acceptance

- K-T-10 passes by name.
- A false `canRevokePermission` produces zero `Revoke` buttons for that row in a DOM test.

## Out of scope

`freeze` and `unfreeze`. Allowance revoke (K11). Watcher changes.

# K13 Spec · Index boundary

## Goal

Lock the two limits from the architecture: this app does not call MetaMask's execution-permission RPC, and it has no store for signatures that were never submitted.

## Source of truth

[docs/lane/security.md](../../lane/security.md) Forbidden in `app/src`. A disagreement is BLOCKED.

## Owns

- `app/src/boundary.test.ts`

No other file. This task does not add a feature.

## Requirements

1. `boundary.test.ts` is named `K-T-13`. It reads every `*.ts` file under `app/src` except itself.
2. The test fails if any of those files contain `wallet_revokeExecutionPermission`, `wallet_getGrantedExecutionPermissions`, or `wallet_requestExecutionPermissions`.
3. The test fails if any of those files contain `unsubmittedPermit` or `offchainDelegation`.
4. The test fails if `signAuthorization` appears in any file other than `app/src/revoke/delegation7702.ts`.
5. The test fails if `dashboard/index.html` is imported from `app/src`.

## Security

This is the check that the click path stays on public records and on `PermissionToken.revoke`.

## Acceptance

- K-T-13 passes on the current `app/src`.
- Adding the forbidden string to a scratch file under `app/src` fails the test. The scratch file is not committed.

## Out of scope

A MetaMask integration. A signature inbox.

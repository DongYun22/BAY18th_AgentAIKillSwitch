# K12 Spec · Watcher auto-revoke

## Goal

When the framework account decision is `permission-token`, the watcher also clears an ERC-20 allowance that a framework-controlled agent grants. When the decision is missing, open, or `eip-7702`, this task does not write code.

## Source of truth

[docs/lane/system.md](../../lane/system.md) §9. [docs/lane/security.md](../../lane/security.md) Writes. [docs/lane/dictionary.md](../../lane/dictionary.md) W-01, W-02, W-03. A disagreement is BLOCKED.

## Owns

When §9 says stop: no file.

When §9 says implement:

- `contracts/src/AgentWallet.sol` (the one function in §9)
- `contracts/test/AgentWalletClear.t.sol`
- `agent-scripts/watcher.js`
- `agent-scripts/watcher.test.mjs`

## Requirements

1. Apply the table in system §9 before any edit. The stop rows change nothing.
2. `clearErc20Allowance` is the function in system §9. No other new function. No edit to `PermissionToken.sol`.
3. The watcher scan is the three bullets in system §9. The existing failed-`execute` path still calls `permissionToken.revoke(state.childId)` and still ignores blocks it has already seen.
4. `watcher.test.mjs` is named `K-T-12`. Cases are quality.md K-T-12. The test key is the Anvil key in security.md and no other key.
5. `AgentWalletClear.t.sol` proves the manager call clears the allowance and the hot agent call reverts `NotManager()`.

## Security

security.md Keys and Writes. Cold does not send `approve` on the hot EOA.

## Acceptance

- Stop rows: empty diff, and the printed line is W-02 or W-03.
- Implement row: K-T-12 passes, `forge test --match-path test/AgentWalletClear.t.sol` passes, and the old `revoke tx:` log line remains.

## Out of scope

Choosing the account (K0). EIP-7702 session keys. MetaMask execution permissions. Permit2. Clearing an allowance owned by the hot EOA.

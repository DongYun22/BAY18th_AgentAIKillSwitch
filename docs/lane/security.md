# Security

Wins over system, dictionary, quality, specs, and plans.

## Keys

- `app/` contains no private key, mnemonic, seed phrase, or RPC URL that includes an API key.
- The watcher reads `COLD_PRIVATE_KEY` from the environment. The app never reads that variable.
- The only key literal allowed in the repo is the Anvil default in `agent-scripts/watcher.test.mjs`: `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`. It is not copied into `.env`, `app/`, or `contracts/`.
- The app does not call `eth_privateKey` and does not render a key input.

## Writes

- A write is sent only after `assertChain(11155111)`.
- `revoke(uint256)` is sent only when `canRevokePermission` is true. Otherwise throw `Not allowed` and send nothing.
- `approve(spender, 0)`, `setApprovalForAll(operator, false)`, and Permit2 `approve(token, spender, 0, 0)` are sent only when the connected address equals the row owner. Otherwise the screen shows D-18 and then D-20 and sends nothing. When that row's owner is an agent with a child token the connected account can revoke, the row also shows D-19, and that button calls `revokePermission`.
- EIP-7702 clear is sent only when the connected address equals the agent. Otherwise D-18 and then D-20, and no `signAuthorization`. The same D-19 rule applies when a child token can be revoked.
- ENSv2 `revokeRoles` or `revokeRootRoles` is sent only when `canRevokeEnsRole` is true, and only to the registry named in `docs/decisions/ens-v2.md`.
- The watcher does not send `approve` from the Cold key. Cold is not the hot key. The only new watcher write is `AgentWallet.clearErc20Allowance`, and only under system §9.

## Forbidden in `app/src`

These strings are absent from every file under `app/src` except `app/src/boundary.test.ts`, which lists them as the needles it searches for:

- `wallet_revokeExecutionPermission`
- `wallet_getGrantedExecutionPermissions`
- `wallet_requestExecutionPermissions`
- `unsubmittedPermit`
- `offchainDelegation`
- `signAuthorization` is allowed only in `app/src/revoke/delegation7702.ts` (K16). Every other file under `app/src` omits it.

## Invariants

- The app does not deploy or edit `PermissionToken`.
- `clearErc20Allowance` does not go through `AgentWallet.execute` and does not consult the allowlist. The parent owner is clearing a call the policy already rejected.
- A failed `execute` still calls `PermissionToken.revoke(state.childId)` once. K12 does not remove that path.

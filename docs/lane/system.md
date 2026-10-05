# System

Types, versions, and calls. Specs name which section they implement. They do not redefine it.

## 1. Versions

`app/package.json` pins these exact versions. No other runtime or test dependency.

| Package | Version | Section |
|---|---|---|
| vite | 8.3.2 | devDependencies |
| typescript | 7.0.2 | devDependencies |
| vitest | 5.0.3 | devDependencies |
| viem | 2.57.2 | dependencies |

Scripts: `dev` is `vite`, `build` is `tsc --noEmit && vite build`, `test` is `vitest run`.

`tsconfig.json`: `strict`, `noEmit`, `module` `ESNext`, `moduleResolution` `bundler`, `target` `ES2022`, `types` `vite/client`. Include `src`.

`vite.config.ts` exports the default Vite config with no plugins.

## 2. Config

`app/src/config.ts` exports `config` and `readFromBlock`. Fields, and no others:

| Field | Value |
|---|---|
| `chainId` | `11155111` |
| `permissionToken` | `0xA09511600787d4BF40A49CE3501af2C23d737584` |
| `agentWallet` | `0x0B26b3d6500E8Cf03189042b3341d5be7774d29F` |
| `permit2` | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |
| `fromBlock` | `readFromBlock(import.meta.env.VITE_FROM_BLOCK)` |
| `logChunk` | `50_000` |

`readFromBlock` accepts a string of base-10 digits and returns that number. Any other input, including `undefined` and `0x` prefixes, throws E-01.

No RPC URL is read in `app/`.

## 3. Types

```ts
type PermissionStatus = 'ACTIVE' | 'FROZEN' | 'REVOKED' | 'EXPIRED'

type PermissionRow = {
  tokenId: bigint
  holder: Address
  parentId: bigint
  spendingLimit: bigint
  allowlist: Address[]
  expiry: bigint
  status: PermissionStatus
}

type IndexedPermissions = {
  roots: PermissionRow[]
  groups: AgentGroup[]
}

type AgentGroup = {
  agent: Address
  permissions: PermissionRow[]
}

type Erc20Allowance = {
  owner: Address
  token: Address
  spender: Address
  amount: bigint
}

type Erc721Operator = {
  owner: Address
  token: Address
  operator: Address
  approved: true
}

type Permit2Allowance = {
  owner: Address
  token: Address
  spender: Address
  amount: bigint
  expiration: bigint
}

type Delegation7702 = {
  agent: Address
  implementation: Address
}

type EnsRole = {
  registry: Address
  resource: bigint
  agent: Address
  roleBitmap: bigint
  revocable: boolean
}

type AgentView = {
  agent: Address
  permissions: PermissionRow[]
  erc20: Erc20Allowance[]
  erc721: Erc721Operator[]
  permit2: Permit2Allowance[]
  delegation: Address | null
  ens: EnsRole[]
}

type ScreenModel = {
  account: AgentView
  agents: AgentView[]
}
```

`Address` is viem's checksummed address. Every address stored in these types has been passed through `getAddress`.

## 4. Permission status

Use the timestamp of the block tagged `latest` from the same client. Do not use `Date.now()`.

1. `ownerOf(tokenId)` reverts: `REVOKED`. Then still call `getPolicy`. `PermissionToken` does not delete the policy on burn, so `spendingLimit`, `allowlist`, and `expiry` come from that return. `holder` and `parentId` stay the values from the mint log.
2. Else if `expiry <= block.timestamp`: `EXPIRED`. This matches `isValid`, which treats `block.timestamp >= expiry` as expired. An expired token that is also frozen is `EXPIRED`.
3. Else if `isValid` is false: `FROZEN`. That includes a frozen ancestor.
4. Else: `ACTIVE`.

`indexPermissions` keeps a mint log when `parentId == 0` and `to == cold`, or when `parentId != 0` and `ownerOf(parentId) == cold`. `ownerOf(parentId)` reverting drops that child. It does not drop other children.

## 5. Log scan

Shared steps. K5, K6, and K7 each inline them. Do not add `app/src/index/logs.ts`.

```text
latest = client.getBlockNumber()
cursor = config.fromBlock
while cursor <= latest:
  end = min(cursor + config.logChunk - 1, latest)
  logs += client.getLogs({ fromBlock: cursor, toBlock: end, event, args })
  cursor = end + 1
```

`getLogs` is not passed an `address` filter, except K7, which passes `address: config.permit2`. A throw becomes E-04. Do not shrink the chunk. Do not substitute a token list.

Latest log for a key is the one with the greater `(blockNumber, logIndex)`.

## 6. Sort

Address order is `getAddress(a) < getAddress(b)` on the checksummed string. Do not lowercase first.

ERC-20 and ERC-721 rows: owner, token, spender or operator. Permit2: owner, token, spender. Agent groups: `agent`. Permissions inside a group and inside `roots`: `tokenId` ascending. ENSv2 roles: `resource` ascending, then `agent`.

## 7. Screen model

`groupAgents(cold, rows)` returns `IndexedPermissions`.

- `roots` is every row with `holder === cold` and `parentId === 0n`, including `REVOKED`, `EXPIRED`, and `FROZEN`.
- A root is not an `AgentGroup`.
- Every other row is grouped by `holder`. `permissions` holds every remaining row with that holder.

`toScreen(cold, indexed, erc20, erc721, permit2, delegations, ens)` returns `ScreenModel`.

- `account.agent` is `cold`. `account.permissions` is `indexed.roots`.
- `account.erc20` is rows whose `owner === cold`. The same rule applies to `erc721`, `permit2`, and `delegation` (`delegation.agent === cold`). No delegation yields `null`.
- Each `agents[]` entry matches one `AgentGroup`. Rows join on `owner === group.agent` or `delegation.agent === group.agent`. `ens` joins on `agent`.
- An ENSv2 assignee that is not `cold` and not already a group is an extra agent with an empty permission list.
- A row whose owner is neither `cold` nor a group agent is dropped. An ENSv2 role is kept when its assignee is in that set, or when `revocable` is true.

`renderAgents` replaces the contents of the root element.

1. Heading D-05. Then one permission line per root. Then D-21 and one ENS line per role on `cold`. Then D-08, D-09, D-10, D-11 and their lines. An empty list is one line, D-12.
2. If `agents.length === 0`, one line D-13.
3. Else, for each agent: a line `Agent` plus the full checksummed address (D-06, then the address). Then D-07 and one permission line per token. Then D-21 and the four record headings, same empty rule. An approval row whose owner is not `cold` is followed by D-18 and then D-20. K9 prints those lines and does not print a button. An ENSv2 role with `revocable` true shows D-19.

The address list passed to K5, K6, K7, and K8 is `cold` plus every `AgentGroup.agent`. Permit2 and EIP-7702 on wallet A appear in the account block. They are not dropped because A is not an agent group.

K9 prints no `button` elements.

## 8. Click calls

Every send calls `assertChain(11155111)` first. A false check throws E-03 and does not call the wallet.

| Task | Function | Check | Call |
|---|---|---|---|
| K10 | `canRevokePermission`, `parentOwner`, `revokePermission` | the `canRevokePermission` bullets in this section | `revoke(uint256)` on `config.permissionToken` |
| K11 | `canRevokeErc20`, `revokeErc20` | connected address equals `row.owner` and `row.amount > 0n` | `approve(spender, 0)` on `row.token` |
| K14 | `canRevokeErc721`, `revokeErc721` | connected address equals `row.owner` | `setApprovalForAll(operator, false)` on `row.token` |
| K15 | `canRevokePermit2`, `revokePermit2` | connected address equals `row.owner` | `approve(token, spender, 0, 0)` on `config.permit2`. The third argument is `uint160` `0`, the fourth is `uint48` `0` |
| K16 | `canClearDelegation`, `clearDelegation` | connected address equals `row.agent` | `signAuthorization({ contractAddress: '0x0000000000000000000000000000000000000000' })`, then `sendTransaction({ authorizationList: [authorization], to: connected, data: '0x', value: 0n })` |
| K17 | `canRevokeEnsRole`, `revokeEnsRole` | `row.revocable` is true, `row.roleBitmap > 0`, and `row.registry` is the Registry in `docs/decisions/ens-v2.md` | `revokeRoles(resource, roleBitmap, agent)` on that registry. Resource 0 sends `revokeRootRoles(roleBitmap, agent)` |

`canRevokePermission(cold, row, parentOwner)`:

- `parentId === 0n`: true only when `row.holder === cold` and `row.status !== 'REVOKED'`.
- else: true only when `parentOwner === cold` and `row.status !== 'REVOKED'`.

`parentOwner(client, row)` returns `ownerOf(parentId)`, or `null` when that call reverts. K10 fetches it before rendering the button. There is no confirm dialog.

A true small-revoke check renders button D-14. A false small-revoke check renders D-18 and then D-20, does not render D-14, and does not send the small call. K10 is the exception for its own rows: a child token A can revoke renders button D-19, and a root token A can revoke renders button D-14. K10 does not render D-18 on a permission line.

On a false small-revoke check, the row owner is `row.owner`, or `row.agent` for a delegation. When that address equals an `AgentGroup.agent` and `canRevokePermission` is true for a child token in that group, the same row also renders button D-19. If more than one such child exists, the child is the one with the lowest `tokenId`. If none exists, the row does not render D-19.

D-19 on a permission row, and D-19 on an approval row, call `revokePermission` for that child. D-19 on an ENSv2 role row calls `revokeEnsRole`. None of these calls `approve`, `setApprovalForAll`, Permit2 `approve`, or `signAuthorization`.

A wallet rejection or a receipt with status 0 leaves the previous DOM in place and prepends a paragraph whose text is D-17. The next successful render replaces the root, so that paragraph goes away.

## 9. Auto revoke

Read `docs/decisions/framework-account.md` before any edit.

| File state | Action |
|---|---|
| Missing, or `Status` is not `decided` | Change no file. Print W-02. Stop. |
| `Choice` is `eip-7702` | Change no file. Print W-03. Stop. Do not add a session-key ABI. |
| `Choice` is `permission-token` | Implement the function and the watcher scan below. |

`AgentWallet.clearErc20Allowance(uint256 tokenId, address token, address spender)`:

- `parent = permissionToken.parentTokenId(tokenId)`.
- Manager is `ownerOf(tokenId)` when `parent == 0`, otherwise `ownerOf(parent)`.
- `msg.sender != manager` reverts `NotManager()`.
- Call `token` with selector `approve(address,uint256)` and arguments `(spender, 0)`. A revert, or a return word equal to false, reverts `ClearFailed()`.
- Emit `Erc20AllowanceCleared(uint256 indexed tokenId, address indexed token, address indexed spender)`.
- Do not call `execute`. Do not read the allowlist.

Watcher, in addition to the existing failed-`execute` path:

- Read `Approval` logs whose owner is `AGENT_WALLET_ADDRESS` and whose spender is not in the child token allowlist from `getPolicy(state.childId)`.
- Live `allowance(AGENT_WALLET_ADDRESS, spender) > 0`: Cold sends `clearErc20Allowance(state.childId, token, spender)`.
- The same log shape with owner `state.hotAgent`: print W-01 and send nothing.
- A failed Hot Agent to AgentWallet transaction still calls `permissionToken.revoke(state.childId)` once and still skips blocks already seen.

## 10. Wallet

`connect` calls `eth_requestAccounts` and returns `getAddress` of the first account.

`watchAccount` subscribes to `accountsChanged`. An empty list calls `onChange(null)`.

`assertChain` throws E-02 when the argument is not `11155111`. It does not call `wallet_switchEthereumChain`.

Screen controls:

- No account: one button, D-02. Click calls `connect`.
- Connected and the wallet chain is not `11155111`: the same button's label is D-04. Click calls `connect` again.
- Connected on `11155111`: the short address, plus a button D-03. D-03 sets the session to null and calls no RPC. `accountsChanged` with an empty list does the same.

`publicClient` is `createPublicClient({ chain: sepolia, transport: custom(window.ethereum) })`. `walletClient` is `createWalletClient({ chain: sepolia, transport: custom(window.ethereum) })`. Both are created in `app/src/wallet.ts`. Index modules receive the client as an argument. They do not construct one.

## 11. Must not create

`app/src/index/logs.ts`, a React component, an ethers import, a second package manager lockfile at the repo root, a session-key module, a MetaMask execution-permission call, a field for an unsubmitted signature.

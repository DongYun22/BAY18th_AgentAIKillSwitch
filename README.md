# Kill switch

Sepolia testnet. A Revoke click on the mock wallet is printed in the terminal. The original replay of the two contracts, which sends nothing: https://bay18th-killswitch.vercel.app

## The problem

A hot agent holds a child of [PermissionToken](https://sepolia.etherscan.io/address/0xA09511600787d4BF40A49CE3501af2C23d737584) and can call [AgentWallet](https://sepolia.etherscan.io/address/0x0B26b3d6500E8Cf03189042b3341d5be7774d29F) `execute`. A call outside the allowlist reverts inside `checkPolicy`. The revert stops that spend. It does not burn the child. The permission stays `ACTIVE`, and an ERC-20 allowance, NFT operator, or Permit2 approval the agent already submitted stays open. The owner is looking at a failed transaction. The delegation is still live.

A reverted spend leaves the permission open.

![A reverted spend leaves the permission open](docs/diagrams/killswitch_05_permission-stays.png)

## The kill switch

The kill switch is the screen plus an off-chain watcher. The watcher polls new blocks with the Cold key. When the Hot Agent's `execute` fails, Cold calls `PermissionToken.revoke` on that child, and the burn takes every token under it. The screen is the tree of what the connected account delegated, and the row says why the revoke happened.

PermissionToken is a soulbound ERC-721. Each token is one policy: a per-call spending limit, an allowlist, and an expiry. Cold mints a root. `mintChild` accepts a child only when the limit is no higher, the expiry is no later, and the allowlist is a subset of the parent. `freeze` is reversible and is checked up the ancestor chain. Only the parent owner can freeze or revoke. The Hot Agent cannot revoke its own token. The full tree is in [`docs/architecture.md`](docs/architecture.md).

A failed transaction burns the permission.

![A failed transaction burns the permission](docs/diagrams/killswitch_01_failed-tx-revoke.png)

## Two features

1. **Click revoke.** The connected wallet revokes a row it can sign. When the row needs the agent key, the row stays and offers `Revoke agent`.
2. **Automatic revoke.** The watcher burns the permission after a blocked call, and the row says why. A revoke the owner signs by hand is marked as by hand.

Both are on the same screen. Click uses the wallet you connected. Automatic uses the watcher, and only while that process is running. A failed `execute` still reverts if the watcher is stopped, and the child stays valid.

## How click revoke works

The account card shows the root permission and, when that account's code is an EIP-7702 delegation, the delegation. Token approvals the account granted on its own stay off that card. Under each agent the page lists the public records that agent submitted: ERC-20 allowances, NFT operators, Permit2 allowances, ENSv2 roles from `EACRolesChanged` on the Sepolia ETHRegistry [`0xD4eBcbBdF463C9c45784603Db0dDD499BC44A8B4`](https://sepolia.etherscan.io/address/0xD4eBcbBdF463C9c45784603Db0dDD499BC44A8B4), and an EIP-7702 delegation. A per-name UserRegistry is outside this index.

`Revoke` is the call the connected account can sign. For a permission token that is `PermissionToken.revoke`. For an allowance the account owns, it is `approve(spender, 0)`. For an NFT operator it is `setApprovalForAll(operator, false)`. For Permit2 it is Permit2 `approve` to zero. For the account's own 7702 delegation it clears the delegation. Those are different calls. Burning the token does not set an allowance to zero.

![The two revokes are different calls](docs/diagrams/killswitch_02_two-revokes.png)

When the agent key would have to sign, the button is `Revoke agent`. The row keeps two lines: "This approval stays until the agent key signs." and "Revoking the agent does not clear this approval." `Revoke agent` on a PermissionToken child calls `revoke` on that child. On an ENSv2 role it calls `revokeRoles` when the connected account is the admin. The allowance the agent already opened is still there after either call.

## How automatic revoke works

The watcher does not wait for a click. A failed execute whose target is outside the allowlist is a blocked call. Two seconds later the watcher revokes that permission, and the row carries both sentences: the Hot Agent tried to spend at an address outside the allowlist, and the watcher revoked the permission two seconds later. A by-hand revoke says the owner did it, and no blocked call came first.

An automatic revoke starts with a blocked call.

![An automatic revoke starts with a blocked call](docs/diagrams/killswitch_04_blocked-first.png)

`clearErc20Allowance` is in the source. The deployed AgentWallet `0x0B26…d29F` does not have that function, so a failed execute to that address is handled as `PermissionToken.revoke`. The right side of the figure below is the other call, the one that sets an allowance to zero. That call runs on chain after a new AgentWallet deploy. A new deploy changes the address, so `contracts/deployments.json`, `agentWallet` in `app/src/config.ts`, and `AGENT_WALLET_ADDRESS` move together.

![A click and an automatic revoke share one screen](docs/diagrams/killswitch_03_click-and-auto.png)

## Run the mock

No key. Copy [`app/.env.example`](app/.env.example) to `app/.env`. The scan starts at block `11805675`, the PermissionToken deploy block.

Terminal 1, the app:

```bash
cd app
cp .env.example .env
npm install
npm run dev
```

Terminal 2, a new account that exists only in the mock:

```bash
cd agent-scripts
npm install
npm run scene
```

Open http://127.0.0.1:5173/?mock=1 and press Connect. Leave that page open. Terminal 3, from `agent-scripts`:

```bash
npm run scenario
```

The mock holds one owner and one hot agent. The root is permission #4, limit 0.003 ETH, allowlist Uniswap, expiry 2030-01-01. The agent holds children #1, #2, and #3, each at 0.001 ETH. On the agent it also grants a WETH allowance of 1 to Uniswap, the Uniswap v3 position NFT operator Seaport, a Permit2 allowance of 0.25 WETH to Uniswap, ENS resource 11, and an EIP-7702 delegation to the MetaMask delegator. `name` and `symbol` are still read from Sepolia, so the rows show those names.

`npm run scenario` plays four beats on the open page:

1. After 1.6s, #2 tries to spend 0.0001 ETH at `0x0000…00b1`. That address is outside the allowlist, so the call is blocked. #2 is still active.
2. After 2s, the watcher revokes #2.
3. After 1.6s, the owner revokes #1 by hand. No blocked call precedes it.
4. #3 stays active, so `Revoke agent` is still on the agent rows.

Refreshing during the play reads whatever beat the mock has already reached. Run `npm run scenario` again to play from the start.

`npm run mock` is the older Cold account, with the permissions already on Sepolia. The first Connect can take about a minute. `npm run qa` lays one allowance, one operator, one Permit2 approval, one role, and one FROZEN permission onto that account, in memory. `npm run mock -- --once` prints the tree and exits. `npm run llm` calls a model and broadcasts. The scene above does not use it.

## Use a real account

Connect the Cold wallet in the app. The network is Sepolia. The app reads from block `11805675` and sends the revokes that wallet can sign.

```bash
cd app
cp .env.example .env
npm install
npm test
npm run dev
```

To put a new delegation on chain and run the watcher against it, use the Cold key from the `agent-scripts` folder. `setup.js` writes `state.json`. The other scripts read it, so run them from that folder.

```bash
cd agent-scripts
npm install
npm run setup       # Cold mints a root, then a child for the Hot Agent
npm run watch       # needs COLD_PRIVATE_KEY; polls new blocks and revokes on a failed execute
npm run normal      # a transfer checkPolicy accepts
npm run malicious   # a transfer outside the allowlist; the watcher revokes
node demoExtra.js   # attenuation rejected, freeze then unfreeze, cascading revoke
```

The mock agents are fixed scripts. Leave `npm run watch` running before `npm run malicious`, or the failed execute reverts and the child stays valid.

Contracts, from a clean checkout:

```bash
cd contracts
forge install foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts
forge build
forge test
# optional deploy: PRIVATE_KEY and RPC_URL
forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast
```

`contracts/lib` is not in the repository. `npm run build` in `app` writes `app/dist`. That folder stays uncommitted.

| Path | Role |
| --- | --- |
| [`app/`](app) | The screen. |
| [`contracts/`](contracts) | `PermissionToken.sol`, `AgentWallet.sol`, tests, `deployments.json`. |
| [`agent-scripts/`](agent-scripts) | Setup, the watcher, the mock wallet, the scenario. |
| [`dashboard/`](dashboard) | The original static replay. Open `index.html`, or `cd dashboard && npx vercel --prod`. |
| [`docs/architecture.md`](docs/architecture.md) | The target tree and each family the index reads. |

`.env`, private keys, and `state.json` are gitignored. The repository contains no key. Use a testnet key, and keep it out of chat, issues, and documents.

# Kill switch

Kill switch is the Sepolia screen for the permissions a cold wallet delegated to a hot agent. [PermissionToken](https://sepolia.etherscan.io/address/0xA09511600787d4BF40A49CE3501af2C23d737584) is a soulbound ERC-721. Each token is one policy: a per-call spending limit, an allowlist, and an expiry. Cold mints a root, and `mintChild` accepts a child only when the limit is no higher, the expiry is no later, and the allowlist is a subset of the parent. [AgentWallet](https://sepolia.etherscan.io/address/0x0B26b3d6500E8Cf03189042b3341d5be7774d29F) holds the ETH. `execute` runs only when the caller owns the token and `checkPolicy` accepts the target and the value. An off-chain watcher polls new blocks with the Cold key. A failed execute becomes `PermissionToken.revoke` on that child, and the burn takes every token under it. The screen writes the reason on the row: the spend was outside the allowlist, and the revoke landed two seconds later. A revoke the owner signs by hand has no blocked call in front of it.

Sepolia testnet · a Revoke click on the mock wallet is printed in the terminal

The original replay of those two contracts, which sends nothing: https://bay18th-killswitch.vercel.app

The page is one tree. The connected account is the root of the tree. Under it are the public agent records tied to that account: PermissionToken children, Permit2, an EIP-7702 delegation, and ENSv2 roles. Under each agent are the approvals that agent submitted: an ERC-20 allowance, an NFT operator, a Permit2 allowance. The account card keeps the root permission and, when that account's code is itself a 7702 delegation, the delegation. Token approvals the account granted on its own stay off that card. Cold signs `Revoke` when Cold is the account that must sign the call. When the row needs the agent key, the row stays and offers `Revoke agent`. Burning the permission token, or revoking the ENS role, leaves an allowance the agent already opened. The target tree is written out in [`docs/architecture.md`](docs/architecture.md).

A failed transaction burns the permission.

![A failed transaction burns the permission](docs/diagrams/killswitch_01_failed-tx-revoke.png)

`PermissionToken.revoke` burns the child token. `approve(spender, 0)` sets an allowance to zero. They are different calls.

![The two revokes are different calls](docs/diagrams/killswitch_02_two-revokes.png)

An automatic revoke starts with a blocked call. A revoke by hand does not.

![An automatic revoke starts with a blocked call](docs/diagrams/killswitch_04_blocked-first.png)

The automatic row is two sentences. The Hot Agent tried to spend at an address outside the allowlist, and the call was blocked. The watcher revoked that permission two seconds later. The by-hand row says the owner revoked it, and no blocked call came first.

## Run the scene

No key. Copy [`app/.env.example`](app/.env.example) to `app/.env` first. The scan start is block `11805675`, the PermissionToken deploy block.

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

The mock holds one owner and one hot agent. The root is permission #4, limit 0.003 ETH, allowlist Uniswap, expiry 2030-01-01. The agent holds children #1, #2, and #3, each at 0.001 ETH. On the agent the mock also grants a WETH allowance of 1 to Uniswap, the Uniswap v3 position NFT operator Seaport, a Permit2 allowance of 0.25 WETH to Uniswap, ENS resource 11, and an EIP-7702 delegation to the MetaMask delegator. `name` and `symbol` are still read from Sepolia, so the rows show those names.

`npm run scenario` then plays four beats on the open page:

1. After 1.6s, #2 tries to spend 0.0001 ETH at `0x0000…00b1`. That address is outside the allowlist, so the call is blocked. #2 is still active.
2. After 2s, the watcher revokes #2.
3. After 1.6s, the owner revokes #1 by hand. No blocked call precedes it.
4. #3 stays active, so `Revoke agent` is still on the agent rows.

Refreshing during the play reads whatever beat the mock has already reached. Run `npm run scenario` again to play from the start. A Revoke click is printed in the terminal and is not broadcast.

## Run against the deployed contracts

Connect the Cold wallet in the app. The network is Sepolia. The app sends the revokes that wallet can sign.

The chain scripts use that same Cold key and write `state.json` in `agent-scripts`. Run them from that folder, in this order when you are bringing a wallet up:

```bash
cd agent-scripts
npm install
npm run setup       # Cold mints a root, then a child for the Hot Agent
npm run watch       # needs COLD_PRIVATE_KEY; polls new blocks and revokes on a failed execute
npm run normal      # a transfer checkPolicy accepts
npm run malicious   # a transfer outside the allowlist; the watcher revokes
node demoExtra.js   # attenuation rejected, freeze then unfreeze, cascading revoke
```

`setup.js` writes `state.json`. The other scripts read it. The mock agents are fixed scripts. `npm run llm` calls a model and broadcasts, and the scene above does not use it.

`npm run mock` is the older Cold account, with the permissions already on Sepolia. The first Connect can take about a minute because the page reads those logs. `npm run qa` lays one allowance, one operator, one Permit2 approval, one role, and one FROZEN permission onto that account, in memory. `npm run mock -- --once` prints the tree and exits.

Contracts, from a clean checkout:

```bash
cd contracts
forge install foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts
forge build
forge test
# optional deploy: PRIVATE_KEY and RPC_URL
forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast
```

`contracts/lib` is not in the repository. `npm run build` in `app` writes `app/dist`. That folder stays uncommitted. `npm test` in `app` is the screen's check.

## The deployed AgentWallet has no allowance clear

`clearErc20Allowance` is in the source. The AgentWallet at `0x0B26…d29F` was deployed without that function, so a failed execute to that address is handled as `PermissionToken.revoke`. The right side of the figure is the other call, the one that sets an allowance to zero. That call runs on chain after a new AgentWallet deploy. A new deploy changes the address, so `contracts/deployments.json`, `agentWallet` in `app/src/config.ts`, and `AGENT_WALLET_ADDRESS` move together.

![A click and an automatic revoke share one screen](docs/diagrams/killswitch_03_click-and-auto.png)

ENSv2 roles come from `EACRolesChanged` on the Sepolia ETHRegistry [`0xD4eBcbBdF463C9c45784603Db0dDD499BC44A8B4`](https://sepolia.etherscan.io/address/0xD4eBcbBdF463C9c45784603Db0dDD499BC44A8B4). A UserRegistry deployed per name is outside this index.

## Where the code lives

| Path | Role |
| --- | --- |
| [`app/`](app) | The screen. Reads Sepolia and sends the revokes the connected wallet can sign. |
| [`contracts/`](contracts) | `PermissionToken.sol`, `AgentWallet.sol`, tests, `deployments.json`. |
| [`agent-scripts/`](agent-scripts) | Setup, the watcher, the mock wallet, the scenario. |
| [`dashboard/`](dashboard) | The original static replay. Open `index.html`, or deploy with `cd dashboard && npx vercel --prod`. It sends no transaction. |
| [`docs/architecture.md`](docs/architecture.md) | The target tree, the two revoke sizes, and each family the index reads. |

## Keys

`.env`, private keys, and `state.json` are gitignored. The repository contains no key. Use a testnet key, and keep it out of chat, issues, and documents.

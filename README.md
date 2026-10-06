# BAY 18th — Agent AI Kill Switch

Code for chapter 5 of the BAY research article "AI Agent Wallet and the permission-delegation structure" (implementation: "Revoke Cash — AI agentic ver.").
Revoke.cash checks and revokes **a wallet's** approvals. This project manages the permissions **a wallet delegated to an AI agent**.

- Dashboard: https://bay18th-killswitch.vercel.app
- Network: Ethereum Sepolia (testnet)
- PermissionToken (soulbound ERC-721): [`0xA09511600787d4BF40A49CE3501af2C23d737584`](https://sepolia.etherscan.io/address/0xA09511600787d4BF40A49CE3501af2C23d737584)
- AgentWallet: [`0x0B26b3d6500E8Cf03189042b3341d5be7774d29F`](https://sepolia.etherscan.io/address/0x0B26b3d6500E8Cf03189042b3341d5be7774d29F)

## Rules the chain enforces

- In the parent-to-child delegation tree, a child cannot receive a wider permission than its parent (attenuation).
- `freeze` is reversible and walks up the parent chain. `revoke` is not reversible and burns every descendant token.
- Only the issuer (the parent token's owner) can freeze or revoke. The Hot Agent cannot revoke its own token.
- `AgentWallet.execute` runs only when `checkPolicy` passes.
- The kill switch is an **off-chain watcher**. Each block, it looks for a failed transaction the Hot Agent sent through AgentWallet, then calls `revoke` with the Cold key.

A failed transaction burns the permission.

![A failed transaction burns the permission](docs/diagrams/killswitch_01_failed-tx-revoke.png)

The two revokes are different calls. Burning a permission token is not the same call as setting an allowance to zero.

![The two revokes are different calls](docs/diagrams/killswitch_02_two-revokes.png)

An automatic revoke starts with a blocked call. A revoke by hand does not.

![An automatic revoke starts with a blocked call](docs/diagrams/killswitch_04_blocked-first.png)

The automatic row is two sentences. The Hot Agent tried to spend at an address outside the allowlist, and the call was blocked. The watcher revoked that permission two seconds later. The by-hand row says the owner revoked it, and no blocked call came first.

## Layout

| Folder | What is in it |
|---|---|
| [`contracts/`](contracts) | Foundry project. `PermissionToken.sol`, `AgentWallet.sol`, deploy scripts, tests, `deployments.json` |
| [`app/`](app) | The connected wallet's permission screen. Revoke buttons, the blocked-call reason, history |
| [`agent-scripts/`](agent-scripts) | Node.js (ethers v6). Setup, mock agents, the watcher, the mock wallet, scenario playback |
| [`dashboard/`](dashboard) | Static dashboard (`index.html`). Replays Blockscout Sepolia transactions into a tree, status, and log. No build |
| [`docs/`](docs) | Article draft and the figures above |

## Run

Pass keys only through `.env` or the shell. See [`.env.example`](.env.example).

### Contracts

```bash
cd contracts
forge install foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts   # lib/ is not in the repo
forge build
forge test
# deploy (optional): PRIVATE_KEY must be set
forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast
```

### Agent scripts

```bash
cd agent-scripts
npm install
npm run setup        # Cold mints a root, then delegates a child to the Hot Agent. Writes state.json
npm run watch        # kill-switch watcher (needs COLD_PRIVATE_KEY)
npm run normal       # a transfer that passes policy
npm run malicious    # a transfer to an address outside the allowlist, then the watcher revokes
node demoExtra.js    # attenuation rejected, freeze/unfreeze, cascading revoke
```

`setup.js` writes `state.json`. The other scripts read it, so run them from this folder.
The mock agents are fixed scripts, not a live LLM.

### App

The app reads Sepolia with the connected wallet and sends the revokes that wallet can sign. The scan starts at block `11805675`, the block where PermissionToken was deployed.

```bash
cd app
cp .env.example .env
npm install
npm test
npm run dev
```

Open the URL the dev server prints, connect the Cold wallet, and leave the network on Sepolia.

Without a wallet extension, the mock wallet opens the same screen.

`npm run mock` shows the old Cold account and the permissions already on Sepolia. The first Connect can take about a minute because the page reads those logs. `npm run qa` adds one allowance, operator, Permit2 approval, role, and FROZEN permission on that account. Nothing is written to chain. `npm run mock -- --once` prints the tree and exits.

To watch a blocked call and the revokes in order, on a new account, leave the page open and play the scenario.

```bash
cd agent-scripts
npm install
npm run scene
```

In another terminal, start the app with `npm run dev`, open http://127.0.0.1:5173/?mock=1, and press Connect. Then run `npm run scenario`. Do not refresh the page while it plays. The order is: permissions active, a call outside the allowlist is blocked, an automatic burn two seconds later, then the owner's revoke by hand.

A Revoke click is printed in the terminal. That transaction is not sent to Sepolia. `npm run llm` needs its own key and broadcasts, so the playback above does not use it. `npm run build` writes `app/dist`. Do not commit that folder.

`clearErc20Allowance` is in the source. The deployed AgentWallet `0x0B26…d29F` does not have that function. A failed execute sent to that address is handled by the watcher as `PermissionToken.revoke`. The right side of the figure below is the automatic path that sets an allowance to zero. The deployed wallet burns the permission token instead. Allowance auto-clear runs on chain only after AgentWallet is deployed again. A new deploy changes the address, so update `contracts/deployments.json`, `agentWallet` in `app/src/config.ts`, and `AGENT_WALLET_ADDRESS` together.

![A click and an automatic revoke share one screen](docs/diagrams/killswitch_03_click-and-auto.png)

ENSv2 roles are read only from `EACRolesChanged` on the Sepolia ETHRegistry `0xD4eBcbBdF463C9c45784603Db0dDD499BC44A8B4`. Per-name UserRegistry deployments are not included.

### Dashboard

Open `dashboard/index.html` in a browser, or serve it as static files. No server build. Deploy with `cd dashboard && npx vercel --prod`.
It shows the two contracts above. Looking up an arbitrary wallet is later work.

## Security

- `.env`, private keys, and `state.json` are gitignored. The repository has no keys.
- Do not paste a private key into chat, an issue, or a document. Use a testnet key only.

# K1 Spec · App scaffold

## Goal

A TypeScript app under `app/` that builds and serves a blank page. It does not connect a wallet and it does not read the chain. The prototype page `dashboard/index.html` stays as it is.

## Source of truth

[docs/lane/system.md](../../lane/system.md) §1 and §2. [docs/lane/dictionary.md](../../lane/dictionary.md) D-01. If this spec disagrees with those sections, stop with the BLOCKED line in [working rules](../../lane/working-rules.md).

## Owns

- `app/package.json`
- `app/tsconfig.json`
- `app/vite.config.ts`
- `app/index.html`
- `app/src/main.ts`
- `app/src/config.ts`
- `app/src/config.test.ts`
- `docs/prompts/.gitkeep`

## Requirements

1. Dependencies, scripts, and `tsconfig.json` are system §1. No other dependency. No React. No ethers.
2. `app/src/config.ts` exports `config` with these fields and no others:
   - `chainId: 11155111`
   - `permissionToken: '0xA09511600787d4BF40A49CE3501af2C23d737584'`
   - `agentWallet: '0x0B26b3d6500E8Cf03189042b3341d5be7774d29F'`
   - `permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3'`
   - `fromBlock: number` read from `import.meta.env.VITE_FROM_BLOCK`
   - `logChunk: 50_000`
3. If `VITE_FROM_BLOCK` is missing or not a base-10 integer, `config` throws `Missing VITE_FROM_BLOCK` at import time.
4. `app/src/main.ts` writes the text `Kill-switch` into `#app` and does not call `eth_requestAccounts`, `eth_getLogs`, or `wallet_revokeExecutionPermission`.
5. `app/index.html` has one empty `<div id="app">`. It does not load `dashboard/index.html`.
6. `config.test.ts` is named `K-T-1`. It imports a pure parser `readFromBlock(value: string | undefined): number` from `config.ts`. Cases: `'100'` returns `100`; `undefined` and `'0x10'` throw `Missing VITE_FROM_BLOCK`.

## Security

No private key, mnemonic, or RPC URL with an API key is committed. The public Sepolia RPC, if any default is set, is a URL with no secret.

## Acceptance

- `npm test` and `npm run build` in `app/` exit 0.
- `dashboard/index.html` has no diff.

## Out of scope

Wallet connect (K2). Any log scan. Any revoke button.

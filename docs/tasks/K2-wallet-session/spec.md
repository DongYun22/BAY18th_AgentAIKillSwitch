# K2 Spec · Wallet session

## Goal

The page can connect one EIP-1193 wallet, show that address, and refuse every chain except Sepolia (`11155111`).

## Source of truth

[docs/lane/system.md](../../lane/system.md) §10. [docs/lane/dictionary.md](../../lane/dictionary.md) D-02, D-03, D-04, and the short-address rule. A disagreement is BLOCKED.

## Owns

- `app/src/wallet.ts`
- `app/src/wallet.test.ts`
- `app/src/main.ts` (the connect control only)

## Requirements

1. `connect(): Promise<Address>` calls `eth_requestAccounts` on `window.ethereum` and returns the first account, checksummed.
2. `watchAccount(onChange: (address: Address | null) => void)` subscribes to `accountsChanged`. An empty account list calls `onChange(null)`.
3. `assertChain`, the two clients, and the three screen states are system §10. The button labels are D-02, D-03, and D-04. `assertChain` does not call `wallet_switchEthereumChain`.
4. `Disconnect` is a button. It is shown only in the connected-on-Sepolia state. Clicking it sets the session to null and calls no RPC.
5. `accountsChanged` with an empty list does the same work as that button.
6. `wallet.test.ts` is named `K-T-2`. It tests `assertChain(11155111)` returns, `assertChain(1)` throws `Wrong chain`, and a pure `shortAddress('0xB6AF02FeEA21e2960A7C14FAf97bAdbE2E982836')` equals `0xB6AF…2836`.

## Security

The app never reads `eth_privateKey` or asks the user to paste a key. The connected address is the only signer for later click tasks.

## Acceptance

- `npm test` in `app/` is green, including K-T-1 and K-T-2.
- Connecting a Sepolia account shows the short address. Connecting on another chain shows `Switch to Sepolia`.

## Out of scope

Reading tokens or allowances. Sending `revoke` or `approve`.

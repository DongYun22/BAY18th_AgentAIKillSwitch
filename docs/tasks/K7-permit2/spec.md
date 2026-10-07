# K7 Spec · Permit2 standing allowance index

## Goal

For each address in the list from system §7, list Permit2 allowances that have been submitted on-chain and are still unexpired and non-zero. The list includes wallet A.

## Source of truth

[docs/lane/system.md](../../lane/system.md) §3 and §5. Permit2 is `config.permit2`. A disagreement is BLOCKED. The expiration comparison uses the `latest` block timestamp, not `Date.now()`.

## Owns

- `app/src/index/permit2.ts`
- `app/src/index/permit2.test.ts`
- `app/src/abi/permit2.ts`

## Requirements

1. Scan this event on `config.permit2` only:
   `Permit(address indexed owner, address indexed token, address indexed spender, uint160 amount, uint48 expiration, uint48 nonce)`.
   Per address in the system §7 list, `topic1` is the owner. Chunks of `config.logChunk` from `config.fromBlock`.
2. Also scan `Approval(address indexed owner, address indexed token, address indexed spender, uint160 amount, uint48 expiration)` on the same contract, same owner filter. Latest log per `(token, spender)` wins across both event types, ordered by `(blockNumber, logIndex)`.
3. Call `allowance(owner, token, spender)` which returns `(uint160 amount, uint48 expiration, uint48 nonce)`. Keep the row when `amount > 0` and `expiration >` the latest block timestamp. The row is `{ owner, token, spender, amount, expiration }`.
4. A Permit2 signature that was never submitted produces no log and no row. Do not add a field for off-chain signatures.
5. `permit2.test.ts` is named `K-T-7`. Cases: live amount 10 and future expiration keeps the row; amount 0 drops it; expiration equal to the block timestamp drops it; an owner that is not the agent is absent.

## Security

Read only. Do not call Permit2 `permit` or `approve`.

## Acceptance

- K-T-7 passes by name.
- `permit2.ts` does not mention `wallet_revokeExecutionPermission`.

## Out of scope

Permit2 `SignatureTransfer` (one-shot, no standing row). EIP-2612 permits on individual tokens. Unsubmitted signatures.

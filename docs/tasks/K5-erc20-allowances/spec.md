# K5 Spec · ERC-20 allowance index

## Goal

For each address in the list, list ERC-20 allowances that address has granted and that are still above zero. The list is wallet A plus every agent, per system §7.

## Source of truth

[docs/lane/system.md](../../lane/system.md) §3, §5, and §6. A disagreement is BLOCKED.

## Owns

- `app/src/index/erc20.ts`
- `app/src/index/erc20.test.ts`

## Requirements

1. `indexErc20Allowances` is called with wallet A and every agent address, per system §7. The function itself still takes `Address[]`.
2. Scan `Approval(address indexed owner, address indexed spender, uint256 value)` with the loop in system §5. One scan per address in the list. `args.owner` is that address. Do not set `address`. A throw is E-04. Do not switch to a token list.
3. For each unique `(token, spender)` keep the latest log by `(blockNumber, logIndex)`. Then call `allowance(owner, spender)` on that token. If the call reverts, drop the row. If the returned amount is `0`, drop the row. The stored amount is the `allowance` return, not the log value.
4. Sort is system §6.
5. `erc20.test.ts` is named `K-T-5`. Fixture logs:
   - one Approval of 5, `allowance` returns 5: one row, amount 5.
   - a later Approval of 0 for the same pair, `allowance` returns 0: the row is absent.
   - two tokens for one agent: two rows.
   - an Approval whose owner topic is a different agent: absent from this agent's result.

## Security

Read only. Do not encode `approve`.

## Acceptance

- K-T-5 passes by name.
- `erc20.ts` contains no `approve(` call.

## Out of scope

The revoke button (K11). NFT operators (K6). Permit2 (K7).

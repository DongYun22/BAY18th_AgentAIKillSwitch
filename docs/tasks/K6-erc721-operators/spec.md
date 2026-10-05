# K6 Spec · ERC-721 operator index

## Goal

For each address in the system §7 list, list NFT operators that address has approved for all tokens of a contract, and that approval is still on. The list includes wallet A.

## Source of truth

[docs/lane/system.md](../../lane/system.md) §3 and §5. A disagreement is BLOCKED. Do not create `app/src/index/logs.ts`. Copy the loop into this file.

## Owns

- `app/src/index/erc721.ts`
- `app/src/index/erc721.test.ts`

## Requirements

1. `indexErc721Operators(client, agents: Address[]): Promise<Erc721Operator[]>` where `Erc721Operator` is `{ owner: Address, token: Address, operator: Address, approved: true }`.
2. Scan `ApprovalForAll(address indexed owner, address indexed operator, bool approved)` with system §5. Per address in the list, `args.owner` is that address. Do not set `address`. A throw is E-04.
3. Latest log per `(token, operator)` wins. Then call `isApprovedForAll(owner, operator)`. Keep the row only when the call returns `true`. A revert drops the row.
4. Sort is system §6.
5. `erc721.test.ts` is named `K-T-6`. Cases: `approved=true` then live `true` keeps the row; a later `approved=false` with live `false` drops it; a different owner is absent.

## Security

Read only. Do not call `setApprovalForAll`.

## Acceptance

- K-T-6 passes by name.
- `erc721.ts` contains no `setApprovalForAll`.

## Out of scope

Single-token `approve(tokenId)` on ERC-721. ERC-1155. The revoke button.

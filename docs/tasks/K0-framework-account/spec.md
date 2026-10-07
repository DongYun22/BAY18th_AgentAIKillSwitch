# K0 Spec · Framework account decision

## Goal

Record which account implementation the automatic revoke path will use. No code ships in this task.

## Source of truth

[docs/architecture.md](../../architecture.md) section "Framework account".

## Owns

- `docs/decisions/framework-account.md` (created by a human, not by an agent)

## Requirements

1. The file has exactly these fields, in this order, as a Markdown heading plus a line `Value:` under each heading:
   - `Status` — `open` or `decided`
   - `Choice` — `permission-token` or `eip-7702` or empty while `Status` is `open`
   - `Date` — `YYYY-MM-DD` when decided, empty while open
   - `Decided by` — a person's name when decided, empty while open
2. `Choice: permission-token` means the watcher keeps using [`PermissionToken.revoke`](../../../contracts/src/PermissionToken.sol) and, in K12, also sends `approve(spender, 0)` from an account this framework can execute.
3. `Choice: eip-7702` means a later spec, not K12, will name the session-key module. K12 must not invent that module.
4. An agent does not create or edit this file. An agent that finds the file missing or `Status: open` stops and reports K12 blocked.
5. This choice does not remove a public format from the screen. Permit2, EIP-7702, ENSv2, and `PermissionToken` stay on the tree together.

## Security

The file contains no private key, no RPC URL with a key, and no seed phrase.

## Acceptance

- A human has either left the file uncreated (`Status` treated as `open`) or written `Status: decided` with one of the two `Choice` values.
- No file under `contracts/`, `agent-scripts/`, `dashboard/`, or `app/` changes in the commit that only records this decision.

## Out of scope

Implementing either account. Session-key storage layouts. MetaMask ERC-7715 grants.

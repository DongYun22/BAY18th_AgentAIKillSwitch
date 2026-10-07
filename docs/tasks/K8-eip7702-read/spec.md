# K8 Spec · EIP-7702 code read

## Goal

Show whether an agent EOA currently delegates its code, and to which implementation. Do not clear that delegation.

## Source of truth

[docs/lane/system.md](../../lane/system.md) §3. [docs/lane/security.md](../../lane/security.md) forbids `signAuthorization` in this file. A disagreement is BLOCKED.

## Owns

- `app/src/index/delegation7702.ts`
- `app/src/index/delegation7702.test.ts`

## Requirements

1. `readDelegation(code: Hex): Address | null`. If `code` is `0x` or does not start with `0xef0100`, return `null`. If it starts with `0xef0100` and the next 20 bytes are an address, return that address checksummed. Any other length returns `null`.
2. `indexDelegations(client, agents: Address[]): Promise<Delegation7702[]>` calls `eth_getCode` at `latest` for each address in the list. The caller passes wallet A and every agent, as system §7. `Delegation7702` is `{ agent: Address, implementation: Address }`. Addresses with `null` are omitted.
3. This module exports no function that signs an authorization or sends a transaction.
4. `delegation7702.test.ts` is named `K-T-8`. Cases:
   - `0x` returns `null`.
   - `0xef0100` plus 20 zero bytes returns the zero address.
   - `0xef0100b6af02feea21e2960a7c14faf97badbe2e982836` returns `0xB6AF02FeEA21e2960A7C14FAf97bAdbE2E982836`.
   - a 22-byte suffix returns `null`.

## Security

Reading code is public. Revoking a 7702 delegation requires a new authorization signed by that EOA. This task does not collect that signature.

## Acceptance

- K-T-8 passes by name.
- `delegation7702.ts` has no `signAuthorization` and no `type: '0x4'` transaction.

## Out of scope

Session keys inside the implementation. Clearing the delegation. The screen layout (K9 only displays the value this module returns).

# K4 Spec · Agent groups

## Goal

Turn permission rows into one record per agent address. The connected wallet is not an agent when it only holds a root token.

## Source of truth

[docs/lane/system.md](../../lane/system.md) §3 and §7, the `groupAgents` bullets. A disagreement is BLOCKED.

## Owns

- `app/src/index/agents.ts`
- `app/src/index/agents.test.ts`

## Requirements

1. `groupAgents(cold: Address, rows: PermissionRow[]): IndexedPermissions`, as system §3 and §7.
2. `roots` contains the cold root, including a `REVOKED` root. That row is not also an `AgentGroup`.
3. Sort is system §6.
4. `agents.test.ts` is named `K-T-4`. Fixture: root held by cold, two children to agent A, one child to agent B. `groups.length` is 2. Agent A's group has two permissions. `roots.length` is 1. Cold is not a group.

## Security

No RPC in this file. It is a pure function of K3's rows.

## Acceptance

- K-T-4 passes by name.
- `agents.ts` does not import `viem` clients and does not call `getLogs`.

## Out of scope

Allowances, Permit2, EIP-7702, HTML.

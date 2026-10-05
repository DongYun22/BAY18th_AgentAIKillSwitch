import { getAddress, type Address } from 'viem'
import { clearDelegation } from '../revoke/delegation7702'
import { canRevokeEnsRole, revokeEnsRole } from '../revoke/ensV2'
import { revokeErc20 } from '../revoke/erc20'
import { revokeErc721 } from '../revoke/erc721'
import { canRevokePermission, revokePermission } from '../revoke/permissionToken'
import { revokePermit2 } from '../revoke/permit2'
import type {
  AgentView,
  Delegation7702,
  EnsRole,
  Erc20Allowance,
  Erc721Operator,
  IndexedPermissions,
  PermissionRow,
  Permit2Allowance,
  ScreenModel,
  Sender,
} from '../types'
import { compareAddress, compareTokenId, sameAddress } from '../types'

export type ScreenActions = {
  sender: Sender
}

let actions: ScreenActions | null = null

export function setScreenActions(next: ScreenActions | null): void {
  actions = next
}

export function toScreen(
  cold: Address,
  indexed: IndexedPermissions,
  erc20: Erc20Allowance[],
  erc721: Erc721Operator[],
  permit2: Permit2Allowance[],
  delegations: Delegation7702[],
  ens: EnsRole[],
): ScreenModel {
  const agents = indexed.groups.map((group) => viewFor(group.agent, group.permissions, erc20, erc721, permit2, delegations, ens))
  const known = new Set<Address>([getAddress(cold), ...agents.map((agent) => agent.agent)])
  for (const role of ens) {
    if (known.has(role.agent)) continue
    known.add(role.agent)
    agents.push(viewFor(role.agent, [], erc20, erc721, permit2, delegations, ens))
  }
  agents.sort((left, right) => compareAddress(left.agent, right.agent))
  return {
    account: viewFor(cold, indexed.roots, erc20, erc721, permit2, delegations, ens),
    agents,
  }
}

function viewFor(
  agent: Address,
  permissions: PermissionRow[],
  erc20: Erc20Allowance[],
  erc721: Erc721Operator[],
  permit2: Permit2Allowance[],
  delegations: Delegation7702[],
  ens: EnsRole[],
): AgentView {
  return {
    agent,
    permissions,
    erc20: erc20.filter((row) => sameAddress(row.owner, agent)),
    erc721: erc721.filter((row) => sameAddress(row.owner, agent)),
    permit2: permit2.filter((row) => sameAddress(row.owner, agent)),
    delegation: delegations.find((row) => sameAddress(row.agent, agent))?.implementation ?? null,
    ens: ens.filter((row) => sameAddress(row.agent, agent)),
  }
}

export function permissionLine(row: PermissionRow): string {
  const list = row.allowlist.length === 0 ? 'none' : row.allowlist.join(',')
  return `#${row.tokenId} ${row.status} ${row.spendingLimit} wei exp ${row.expiry} allow ${list}`
}

export function renderAgents(root: HTMLElement, model: ScreenModel): void {
  root.replaceChildren()
  const cold = model.account.agent
  line(root, 'Account')
  for (const row of model.account.permissions) {
    permissionBlock(root, model, cold, row, model.account.permissions)
  }
  recordBlock(root, model, cold, model.account, model.account.permissions)
  if (model.agents.length === 0) {
    line(root, 'No agents for this account')
    return
  }
  for (const agent of model.agents) {
    line(root, `Agent ${agent.agent}`)
    line(root, 'Permission')
    for (const row of agent.permissions) {
      permissionBlock(root, model, cold, row, agent.permissions)
    }
    recordBlock(root, model, cold, agent, agent.permissions)
  }
}

function permissionBlock(
  root: HTMLElement,
  model: ScreenModel,
  cold: Address,
  row: PermissionRow,
  siblings: PermissionRow[],
): void {
  line(root, permissionLine(row))
  const parent = parentOwner(model, row)
  if (!canRevokePermission(cold, row, parent)) return
  const label = row.parentId === 0n ? 'Revoke' : 'Revoke agent'
  button(root, label, async () => {
    if (!actions) return
    await revokePermission(actions.sender, cold, row, parent)
  })
  void siblings
}

function recordBlock(
  root: HTMLElement,
  model: ScreenModel,
  cold: Address,
  view: AgentView,
  permissions: PermissionRow[],
): void {
  line(root, 'Roles')
  if (view.ens.length === 0) line(root, 'none')
  for (const row of view.ens) {
    line(root, `${row.resource} ${row.agent}`)
    if (!canRevokeEnsRole(row)) continue
    button(root, 'Revoke agent', async () => {
      if (!actions) return
      await revokeEnsRole(actions.sender, row)
    })
  }
  line(root, 'Allowances')
  if (view.erc20.length === 0) line(root, 'none')
  for (const row of view.erc20) approvalRow(root, model, cold, permissions, sameAddress(row.owner, cold), `${row.token} ${row.spender} ${row.amount}`, async () => {
    if (!actions) return
    await revokeErc20(actions.sender, cold, row)
  })
  line(root, 'Operators')
  if (view.erc721.length === 0) line(root, 'none')
  for (const row of view.erc721) approvalRow(root, model, cold, permissions, sameAddress(row.owner, cold), `${row.token} ${row.operator}`, async () => {
    if (!actions) return
    await revokeErc721(actions.sender, cold, row)
  })
  line(root, 'Permit2')
  if (view.permit2.length === 0) line(root, 'none')
  for (const row of view.permit2) approvalRow(root, model, cold, permissions, sameAddress(row.owner, cold), `${row.token} ${row.spender} ${row.amount} exp ${row.expiration}`, async () => {
    if (!actions) return
    await revokePermit2(actions.sender, cold, row)
  })
  line(root, 'Delegation')
  if (view.delegation === null) {
    line(root, 'none')
    return
  }
  approvalRow(root, model, cold, permissions, sameAddress(view.agent, cold), view.delegation, async () => {
    if (!actions) return
    await clearDelegation(actions.sender, view.agent)
  })
}

function approvalRow(
  root: HTMLElement,
  model: ScreenModel,
  cold: Address,
  permissions: PermissionRow[],
  owned: boolean,
  text: string,
  send: () => Promise<void>,
): void {
  line(root, text)
  if (owned) {
    button(root, 'Revoke', send)
    return
  }
  line(root, 'This approval stays until the agent key signs.')
  line(root, 'Revoking the agent does not clear this approval.')
  const child = lowestRevocableChild(model, cold, permissions)
  if (child === null) return
  button(root, 'Revoke agent', async () => {
    if (!actions) return
    await revokePermission(actions.sender, cold, child, parentOwner(model, child))
  })
}

function lowestRevocableChild(model: ScreenModel, cold: Address, permissions: PermissionRow[]): PermissionRow | null {
  const matches = permissions
    .filter((row) => canRevokePermission(cold, row, parentOwner(model, row)))
    .sort((left, right) => compareTokenId(left.tokenId, right.tokenId))
  return matches[0] ?? null
}

function parentOwner(model: ScreenModel, row: PermissionRow): Address | null {
  if (row.parentId === 0n) return null
  const root = model.account.permissions.find((item) => item.tokenId === row.parentId)
  if (!root) return null
  return root.holder
}

function line(root: HTMLElement, text: string): void {
  const node = document.createElement('p')
  node.textContent = text
  root.append(node)
}

function button(root: HTMLElement, text: string, send: () => Promise<void>): void {
  const node = document.createElement('button')
  node.textContent = text
  node.addEventListener('click', () => {
    void send().catch((error: unknown) => {
      if (error instanceof Error && error.message === 'Not allowed') return
      const failed = document.createElement('p')
      failed.textContent = 'Revoke failed'
      root.prepend(failed)
    })
  })
  root.append(node)
}

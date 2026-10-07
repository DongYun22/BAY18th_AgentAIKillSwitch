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
  PermissionStatus,
  Permit2Allowance,
  ScreenModel,
  Sender,
} from '../types'
import type { Identity } from '../index/labels'
import { compareAddress, compareTokenId, sameAddress } from '../types'

export type ScreenActions = {
  sender: Sender
  refresh?: () => void
}

type DetailAction = {
  label: string
  ghost: boolean
  send: () => Promise<void>
}

type Detail = {
  key: string
  title: string
  place: string
  line: string
  full: string
  bits: Array<[string, string]>
  badge: string | null
  notes: string[]
  action: DetailAction | null
}

let actions: ScreenActions | null = null
let selectedKey: string | null = null
let shown: Detail | null = null
const openState = new Map<string, boolean>()
const busyKeys = new Set<string>()
const sessionKeys = new Set<string>()
const catalog = new Map<string, Detail>()
let identities = new Map<string, Identity>()

export type WatchEvent = {
  level: 'EXEC' | 'KILL'
  actor: string
  detail: string
  note: string
  result: 'BLOCKED' | 'REVOKED'
  seconds: number | null
}

let watchEvents: WatchEvent[] = []
let roleOwner = ''
const roleAgents = new Set<string>()

export function setWatchEvents(next: WatchEvent[]): void {
  watchEvents = next
}

export function setIdentities(next: Map<string, Identity>): void {
  identities = next
}

export function setScreenActions(next: ScreenActions | null): void {
  actions = next
  if (next === null) {
    selectedKey = null
    shown = null
    openState.clear()
    busyKeys.clear()
    sessionKeys.clear()
    catalog.clear()
    identities = new Map()
    watchEvents = []
  }
}

export function beginLoad(): void {
  sessionKeys.clear()
}

export function renderReading(root: HTMLElement, done: string[], current: string | null): void {
  root.replaceChildren()
  for (const name of done) {
    const row = document.createElement('p')
    row.className = 'read-line'
    row.textContent = name
    root.append(row)
  }
  if (current === null) return
  const row = document.createElement('p')
  row.className = 'read-line now'
  row.textContent = current
  const cursor = document.createElement('span')
  cursor.className = 'cursor'
  row.append(cursor)
  root.append(row)
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
  shown = null
  catalog.clear()
  roleOwner = model.account.agent.toLowerCase()
  roleAgents.clear()
  for (const agent of model.agents) roleAgents.add(agent.agent.toLowerCase())
  root.replaceChildren()
  const cold = model.account.agent
  card(root, 'Account', 'account', true, null, (body) => {
    group(body, 'Permission', cold, model.account.permissions, (host, row) => {
      permissionBlock(root, host, model, cold, row)
    })
    recordBlock(root, body, model, cold, model.account, model.account.permissions)
    if (model.agents.length === 0) {
      line(body, 'No agents for this account', 'sub')
      return
    }
    for (const agent of model.agents) {
      card(body, agentTitle(agent.agent), `agent:${agent.agent}`, true, agent.agent, (agentBody) => {
        group(agentBody, 'Permission', agent.agent, agent.permissions, (host, row) => {
          permissionBlock(root, host, model, cold, row)
        })
        recordBlock(root, agentBody, model, cold, agent, agent.permissions)
      })
    }
  })
}

export function renderStatus(root: HTMLElement, model: ScreenModel): void {
  root.replaceChildren()
  const views = [model.account, ...model.agents]
  const permissions = views.flatMap((view) => view.permissions)
  const count = (status: PermissionStatus): number => permissions.filter((row) => row.status === status).length
  const account = model.account
  const rows: Array<[string, string]> = [
    ['account', account.agent],
    ['agents', String(model.agents.length)],
    ['active', String(count('ACTIVE'))],
    ['frozen', String(count('FROZEN'))],
    ['revoked', String(count('REVOKED'))],
    ['expired', String(count('EXPIRED'))],
    ['Roles', String(model.agents.reduce((sum, view) => sum + view.ens.length, 0))],
    ['Allowances', String(model.agents.reduce((sum, view) => sum + view.erc20.length, 0))],
    ['Operators', String(model.agents.reduce((sum, view) => sum + view.erc721.length, 0))],
    ['Permit2', String(model.agents.reduce((sum, view) => sum + view.permit2.length, 0))],
    ['Delegation', String(views.filter((view) => view.delegation !== null).length)],
    ['reason', autoResponse()],
  ]
  const grid = document.createElement('div')
  grid.className = 'kv'
  for (const [key, value] of rows) {
    const name = document.createElement('div')
    name.textContent = key
    const cell = document.createElement('div')
    cell.textContent = key === 'account' ? short(value) : value
    if (key === 'account') hover(cell, value)
    grid.append(name, cell)
  }
  root.append(grid)
  const detail = shown
  if (detail) root.append(detailPanel(root, detail))
  root.append(historyBlock(model))
}

function permissionBlock(
  screen: HTMLElement,
  host: HTMLElement,
  model: ScreenModel,
  cold: Address,
  row: PermissionRow,
): void {
  const key = `perm:${row.tokenId.toString()}`
  const place = sameAddress(row.holder, cold) ? 'Account' : `Agent ${short(row.holder)}`
  const parent = parentOwner(model, row)
  const allowed = canRevokePermission(cold, row, parent)
  const label = row.parentId === 0n ? 'Revoke' : 'Revoke agent'
  const send = allowed
    ? async () => {
        if (!actions) return
        await revokePermission(actions.sender, cold, row, parent)
        row.status = 'REVOKED'
      }
    : null
  const hit = document.createElement('div')
  hit.className = selectedKey === key ? 'hit on' : 'hit'
  hit.addEventListener('click', () => {
    select(key)
  })
  const wrap = document.createElement('div')
  wrap.className = 'row'
  const branch = document.createElement('span')
  branch.className = 'branch'
  branch.textContent = '└─'
  const name = document.createElement('span')
  name.className = 'strong'
  name.textContent = `#${row.tokenId}`
  const origin = document.createElement('span')
  origin.className = 'origin'
  origin.textContent = place
  const role = knownRole(row.holder)
  const appName = names(row.allowlist)
  if (appName !== '') {
    const app = document.createElement('span')
    app.className = 'app'
    app.textContent = appName
    hover(app, row.allowlist.join(','))
    wrap.append(branch, name, origin)
    if (role !== null) wrap.append(roleChip(role))
    wrap.append(app, statusBadge(row.status))
  } else {
    wrap.append(branch, name, origin)
    if (role !== null) wrap.append(roleChip(role))
    wrap.append(statusBadge(row.status))
  }
  const cause = permissionCause(row.tokenId, row.status)
  if (cause?.chip) {
    const mark = document.createElement('span')
    mark.className = cause.kind === 'auto' ? 'kill' : 'badge b-frozen'
    mark.textContent = cause.chip
    wrap.append(mark)
  }
  if (send) wrap.append(actionButton(screen, label, label === 'Revoke' ? '' : 'ghost', key, send))
  const copy = document.createElement('p')
  copy.className = 'sub'
  copy.textContent = permissionShown(row)
  hover(copy, permissionLine(row))
  hit.append(wrap, copy)
  if (cause) {
    hit.className = `${hit.className} cause-${cause.kind}`
    for (const sentence of cause.lines) {
      const why = document.createElement('p')
      why.className = 'cause'
      why.textContent = sentence
      hit.append(why)
    }
  }
  host.append(hit)
  consider({
    key,
    title: 'Permission',
    place,
    line: permissionShown(row),
    full: permissionLine(row),
    bits: [
      [place, short(row.holder)],
      ['allow', allowShown(row.allowlist)],
      ['Permission', `#${row.tokenId}`],
      ['limit', showWei(row.spendingLimit)],
      ['exp', showTime(row.expiry)],
    ],
    badge: row.status,
    notes: cause ? cause.lines : [],
    action: send ? { label, ghost: label !== 'Revoke', send } : null,
  })
}

function recordBlock(
  screen: HTMLElement,
  host: HTMLElement,
  model: ScreenModel,
  cold: Address,
  view: AgentView,
  permissions: PermissionRow[],
): void {
  const place = sameAddress(view.agent, cold) ? 'Account' : `Agent ${short(view.agent)}`
  const onAccount = place === 'Account'
  if (!onAccount) {
  group(host, 'Roles', view.agent, view.ens, (body, row) => {
    const key = `ens:${row.resource.toString()}:${row.agent}`
    const text = `${row.resource} ${short(row.agent)}`
    const full = `${row.resource} ${row.agent}`
    const send = row.revoked === true || !canRevokeEnsRole(row)
      ? null
      : async () => {
          if (!actions) return
          await revokeEnsRole(actions.sender, row)
          row.revoked = true
        }
    const control = row.revoked === true
      ? statusBadge('REVOKED')
      : send
        ? actionButton(screen, 'Revoke agent', 'ghost', key, send)
        : null
    beside(body, key, place, `Roles ${row.resource}`, row.agent, text, full, control)
    consider({
      key,
      title: 'Roles',
      place,
      line: text,
      full,
      bits: [
        [place, short(view.agent)],
        ['Roles', row.resource.toString()],
        ['Agent', short(row.agent)],
      ],
      badge: row.revoked === true ? 'REVOKED' : null,
      notes: [],
      action: send ? { label: 'Revoke agent', ghost: true, send } : null,
    })
  })
  group(host, 'Allowances', view.agent, view.erc20, (body, row) => {
    approvalRow(screen, body, model, cold, permissions, `erc20:${row.owner}:${row.token}:${row.spender}`, 'Allowances', place, appOf(row.spender), row.spender, sameAddress(row.owner, cold), row.revoked === true, `${tokenLabel(row.token)} ${party(row.spender)} ${showAmount(row.amount, row.token)}`, `${row.token} ${row.spender} ${row.amount}`, [
      [place, short(row.owner)],
      ['spender', party(row.spender)],
      ['token', tokenLabel(row.token)],
      ['amount', showAmount(row.amount, row.token)],
    ], async () => {
      if (!actions) return
      await revokeErc20(actions.sender, cold, row)
      row.revoked = true
    })
  })
  group(host, 'Operators', view.agent, view.erc721, (body, row) => {
    approvalRow(screen, body, model, cold, permissions, `erc721:${row.owner}:${row.token}:${row.operator}`, 'Operators', place, appOf(row.operator), row.operator, sameAddress(row.owner, cold), row.revoked === true, `${tokenLabel(row.token)} ${party(row.operator)}`, `${row.token} ${row.operator}`, [
      [place, short(row.owner)],
      ['operator', party(row.operator)],
      ['token', tokenLabel(row.token)],
    ], async () => {
      if (!actions) return
      await revokeErc721(actions.sender, cold, row)
      row.revoked = true
    })
  })
  group(host, 'Permit2', view.agent, view.permit2, (body, row) => {
    approvalRow(screen, body, model, cold, permissions, `permit2:${row.owner}:${row.token}:${row.spender}`, 'Permit2', place, appOf(row.spender), row.spender, sameAddress(row.owner, cold), row.revoked === true, `${tokenLabel(row.token)} ${party(row.spender)} ${showAmount(row.amount, row.token)} exp ${showTime(row.expiration)}`, `${row.token} ${row.spender} ${row.amount} exp ${row.expiration}`, [
      [place, short(row.owner)],
      ['spender', party(row.spender)],
      ['token', tokenLabel(row.token)],
      ['amount', showAmount(row.amount, row.token)],
      ['exp', showTime(row.expiration)],
    ], async () => {
      if (!actions) return
      await revokePermit2(actions.sender, cold, row)
      row.revoked = true
    })
  })
  }
  const delegation = view.delegation === null ? [] : [view.delegation]
  group(host, 'Delegation', view.agent, delegation, (body, implementation) => {
    approvalRow(screen, body, model, cold, permissions, `del:${view.agent}`, 'Delegation', place, appOf(implementation), implementation, sameAddress(view.agent, cold), view.delegationRevoked === true, short(implementation), implementation, [
      [place, short(view.agent)],
      ['Delegation', party(implementation)],
    ], async () => {
      if (!actions) return
      await clearDelegation(actions.sender, view.agent)
      view.delegationRevoked = true
    })
  })
}

function approvalRow(
  screen: HTMLElement,
  host: HTMLElement,
  model: ScreenModel,
  cold: Address,
  permissions: PermissionRow[],
  key: string,
  title: string,
  place: string,
  app: string,
  appFull: string,
  owned: boolean,
  revoked: boolean,
  text: string,
  full: string,
  bits: Array<[string, string]>,
  send: () => Promise<void>,
): void {
  if (revoked) {
    beside(host, key, place, app, appFull, text, full, statusBadge('REVOKED'))
    consider({ key, title, place, line: text, full, bits, badge: 'REVOKED', notes: [], action: null })
    return
  }
  if (owned) {
    beside(host, key, place, app, appFull, text, full, actionButton(screen, 'Revoke', '', key, send))
    consider({ key, title, place, line: text, full, bits, badge: null, notes: [], action: { label: 'Revoke', ghost: false, send } })
    return
  }
  const child = lowestRevocableChild(model, cold, permissions)
  const agentSend = child === null
    ? null
    : async () => {
        if (!actions) return
        await revokePermission(actions.sender, cold, child, parentOwner(model, child))
        child.status = 'REVOKED'
        sessionKeys.add(`perm:${child.tokenId.toString()}`)
      }
  const control = agentSend === null ? null : actionButton(screen, 'Revoke agent', 'ghost', key, agentSend)
  beside(host, key, place, app, appFull, text, full, control)
  const notes = ['This approval stays until the agent key signs.', 'Revoking the agent does not clear this approval.']
  for (const note of notes) line(host, note, 'note')
  consider({
    key,
    title,
    place,
    line: text,
    full,
    bits,
    badge: null,
    notes,
    action: agentSend ? { label: 'Revoke agent', ghost: true, send: agentSend } : null,
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

function statusClass(status: PermissionStatus): string {
  switch (status) {
    case 'ACTIVE':
      return 'b-active'
    case 'FROZEN':
      return 'b-frozen'
    case 'REVOKED':
      return 'b-revoked'
    case 'EXPIRED':
      return 'b-expired'
    default: {
      const unreachable: never = status
      return unreachable
    }
  }
}

function line(root: HTMLElement, text: string, className?: string): void {
  const node = document.createElement('p')
  node.textContent = text
  if (className) node.className = className
  root.append(node)
}

function beside(
  root: HTMLElement,
  key: string,
  place: string,
  app: string,
  appFull: string,
  text: string,
  full: string,
  control: HTMLElement | null,
): void {
  const wrap = document.createElement('div')
  wrap.className = selectedKey === key ? 'item on' : 'item'
  wrap.addEventListener('click', () => {
    select(key)
  })
  const origin = document.createElement('span')
  origin.className = 'origin'
  origin.textContent = place
  const copy = document.createElement('p')
  copy.className = 'sub'
  copy.textContent = text
  hover(copy, full)
  if (app === '') wrap.append(origin, copy)
  else {
    const targetName = document.createElement('span')
    targetName.className = 'app'
    targetName.textContent = app
    hover(targetName, appFull)
    wrap.append(origin, targetName, copy)
  }
  if (control) wrap.append(control)
  root.append(wrap)
}

function hover(node: HTMLElement, value: string): void {
  node.title = value
}

function identityOf(address: string): Identity | undefined {
  return identities.get(address.toLowerCase())
}

function appOf(address: string): string {
  return identityOf(address)?.app ?? ''
}

function names(addresses: readonly string[]): string {
  const found: string[] = []
  for (const address of addresses) {
    const name = appOf(address)
    if (name !== '' && !found.includes(name)) found.push(name)
  }
  return found.join(', ')
}

function tokenLabel(address: string): string {
  return identityOf(address)?.token ?? short(address)
}

function party(address: string): string {
  return appOf(address) === '' ? short(address) : appOf(address)
}

function allowShown(addresses: readonly string[]): string {
  if (addresses.length === 0) return 'none'
  return addresses.map((item) => party(item)).join(',')
}

function knownRole(address: string): 'Owner' | 'Hot Agent' | null {
  const key = address.toLowerCase()
  if (key === roleOwner) return 'Owner'
  if (roleAgents.has(key)) return 'Hot Agent'
  return null
}

function roleChip(name: string): HTMLElement {
  const node = document.createElement('span')
  node.className = 'role'
  node.textContent = name
  return node
}

function agentTitle(address: Address): string {
  const role = knownRole(address)
  return role === null ? `Agent ${short(address)}` : `${role} ${short(address)}`
}

function permissionShown(row: PermissionRow): string {
  const grant = row.parentId === 0n ? 'ROOT' : `P#${row.parentId} → ${knownRole(row.holder) ?? short(row.holder)}`
  return `#${row.tokenId} ${row.status} ${grant} limit ${showWei(row.spendingLimit)} / ${timeLeft(row.expiry)} / allow ${allowShown(row.allowlist)}`
}

function timeLeft(expiry: bigint): string {
  const stamp = Number(expiry)
  if (!Number.isSafeInteger(stamp)) return showTime(expiry)
  const left = stamp - Math.floor(Date.now() / 1000)
  if (left <= 0) return 'expired'
  const days = Math.floor(left / 86400)
  const hours = Math.floor((left % 86400) / 3600)
  if (days > 0) return `${days}d ${hours}h left`
  const minutes = Math.floor((left % 3600) / 60)
  if (hours > 0) return `${hours}h ${minutes}m left`
  return `${minutes}m left`
}

function autoResponse(): string {
  const kill = watchEvents.find((event) => event.level === 'KILL' && event.seconds !== null)
  const exec = watchEvents.find((event) => event.level === 'EXEC')
  if (!kill) {
    return exec ? 'A call was blocked because the address is outside the allowlist. The permission is still active.' : '—'
  }
  const id = /#(\d+)/.exec(kill.detail)
  const which = id === null ? 'The permission' : `Permission #${id[1]}`
  return `${which} was revoked ${kill.seconds}s later, because a spend went outside the allowlist.`
}

function explainBlock(event: WatchEvent): string {
  const match = /^P#(\d+)\s*→\s*(\S+)\s*·\s*(.+)$/.exec(event.detail)
  if (event.note === 'target not in allowlist' && match) {
    return `Hot Agent tried to spend ${match[3]} at ${short(match[2])}. That address is not on the allowlist, so the call was blocked.`
  }
  if (match) return `${event.actor} tried to spend ${match[3]} at ${short(match[2])}. ${event.note}`
  return event.note === '' ? event.detail : `${event.detail}. ${event.note}`
}

function permissionCause(tokenId: bigint, status: PermissionStatus): { kind: 'blocked' | 'auto' | 'manual'; lines: string[]; chip: string | null } | null {
  const id = tokenId.toString()
  const exec = watchEvents.find((event) => event.level === 'EXEC' && event.detail.includes(`P#${id}`))
  const kill = watchEvents.find((event) => event.level === 'KILL' && event.detail.includes(`#${id}`))
  if (exec && kill && kill.seconds !== null) {
    return {
      kind: 'auto',
      lines: [
        explainBlock(exec),
        `The watcher revoked this permission ${kill.seconds}s later.`,
      ],
      chip: 'automatic',
    }
  }
  if (exec) {
    return {
      kind: 'blocked',
      lines: [
        explainBlock(exec),
        'This permission is still active. The watcher has not revoked it yet.',
      ],
      chip: 'blocked call',
    }
  }
  if (status === 'REVOKED') {
    return {
      kind: 'manual',
      lines: ['The owner revoked this permission by hand. No blocked call came before it.'],
      chip: null,
    }
  }
  return null
}

function watchedPermission(tokenId: bigint): boolean {
  return watchEvents.some((event) => event.level === 'KILL' && event.detail.includes(`#${tokenId.toString()}`))
}

function incidents(events: WatchEvent[]): Array<{ exec: WatchEvent | null; kill: WatchEvent | null }> {
  const groups = new Map<string, { exec: WatchEvent | null; kill: WatchEvent | null }>()
  const order: string[] = []
  for (const event of events) {
    const id = /#(\d+)/.exec(event.detail)?.[1] ?? event.detail
    const group = groups.get(id) ?? { exec: null, kill: null }
    if (!groups.has(id)) order.push(id)
    if (event.level === 'EXEC') group.exec = event
    if (event.level === 'KILL') group.kill = event
    groups.set(id, group)
  }
  return order.map((id) => {
    const group = groups.get(id)
    if (!group) return { exec: null, kill: null }
    return group
  })
}

function incidentCard(body: HTMLElement, incident: { exec: WatchEvent | null; kill: WatchEvent | null }): void {
  const card = document.createElement('div')
  const live = incident.kill === null
  card.className = live ? 'incident live' : 'incident'
  const title = document.createElement('p')
  title.className = 'cause'
  const seconds = incident.kill?.seconds
  title.textContent = seconds !== null && seconds !== undefined
    ? `Automatic revoke, ${seconds}s after the blocked call`
    : 'Blocked call. The permission is still active.'
  card.append(title)
  if (incident.exec) {
    const why = document.createElement('p')
    why.textContent = explainBlock(incident.exec)
    card.append(why)
  }
  if (incident.kill) {
    const id = /#(\d+)/.exec(incident.kill.detail)?.[1] ?? ''
    const done = document.createElement('p')
    done.textContent = id === ''
      ? 'The watcher revoked the permission.'
      : `The watcher revoked permission #${id}.`
    card.append(done)
  }
  body.append(card)
}

function showWei(value: bigint): string {
  if (value < 1_000_000_000_000n) return `${value.toString()} wei`
  return `${units(value, 18)} ETH`
}

function showAmount(value: bigint, token: string): string {
  const decimals = identityOf(token)?.decimals
  if (decimals === null || decimals === undefined) return compact(value)
  const text = units(value, decimals)
  if (text === '0' || text.startsWith('0.000000')) return compact(value)
  return text
}

function units(value: bigint, decimals: number): string {
  const base = 10n ** BigInt(decimals)
  const whole = value / base
  const rest = (value % base).toString().padStart(decimals, '0').replace(/0+$/, '')
  const frac = rest.slice(0, 6).replace(/0+$/, '')
  if (frac.length === 0) return whole.toString()
  return `${whole}.${frac}`
}

function compact(value: bigint): string {
  const raw = value.toString()
  if (raw.length <= 8) return raw
  const exp = raw.length - 1
  const lead = raw.slice(0, 4).replace(/0+$/, '')
  const head = lead.length <= 1 ? lead : `${lead[0]}.${lead.slice(1)}`
  return `${head}e${exp}`
}

function showTime(value: bigint): string {
  const stamp = Number(value)
  if (!Number.isSafeInteger(stamp) || stamp < 1_000_000_000 || stamp > 4_000_000_000) return value.toString()
  const date = new Date(stamp * 1000)
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${date.getUTCFullYear()}-${month}-${day}`
}

function select(key: string): void {
  selectedKey = key
  actions?.refresh?.()
}

function consider(detail: Detail): void {
  catalog.set(detail.key, detail)
  if (selectedKey === detail.key) shown = detail
}

function short(address: string): string {
  return `0x${address.slice(2, 6)}…${address.slice(-4)}`
}

function detailPanel(screen: HTMLElement, detail: Detail): HTMLElement {
  const panel = document.createElement('div')
  panel.className = 'detail'
  const kicker = document.createElement('p')
  kicker.className = 'kicker'
  kicker.textContent = detail.title
  const place = document.createElement('p')
  place.className = 'full'
  place.textContent = detail.place
  panel.append(kicker, place)
  if (detail.bits.length > 0) {
    const grid = document.createElement('div')
    grid.className = 'kv'
    for (const [name, value] of detail.bits) {
      const label = document.createElement('div')
      label.textContent = name
      const cell = document.createElement('div')
      cell.textContent = value
      grid.append(label, cell)
    }
    panel.append(grid)
  }
  const copy = document.createElement('p')
  copy.className = 'sub'
  copy.textContent = detail.line
  hover(copy, detail.full)
  panel.append(copy)
  if (detail.badge && isStatus(detail.badge)) panel.append(statusBadge(detail.badge))
  for (const note of detail.notes) line(panel, note, 'note')
  if (detail.action) {
    const tone = detail.action.ghost ? 'ghost' : ''
    panel.append(actionButton(screen, detail.action.label, tone, detail.key, detail.action.send))
  }
  return panel
}

type Hist = {
  key: string
  place: string
  line: string
  badge: string | null
  auto: boolean
}

function historyBlock(model: ScreenModel): HTMLElement {
  const items = historyItems(model)
  const open = isOpen('history', true)
  const box = document.createElement('div')
  box.className = open ? 'sec hist-sec' : 'sec hist-sec shut'
  box.append(foldButton('History', items.length + watchEvents.length, 'history', true))
  const body = document.createElement('div')
  body.className = 'sec-body'
  if (items.length === 0 && watchEvents.length === 0) line(body, 'none', 'sub')
  for (const incident of incidents(watchEvents)) incidentCard(body, incident)
  for (const item of items) {
    const row = document.createElement('div')
    const selected = selectedKey === item.key ? ' on' : ''
    row.className = item.auto ? `hist log-auto${selected}` : `hist${selected}`
    row.addEventListener('click', () => {
      select(item.key)
    })
    if (item.key.startsWith('perm:')) {
      const level = document.createElement('span')
      level.className = 'lvl'
      level.textContent = 'By hand'
      row.append(level)
    }
    const origin = document.createElement('span')
    origin.className = 'origin'
    origin.textContent = item.key.startsWith('perm:') ? 'Owner' : item.place
    const copy = document.createElement('p')
    const permissionId = item.key.startsWith('perm:') ? item.key.slice('perm:'.length) : ''
    copy.textContent = permissionId === ''
      ? item.line
      : `The owner revoked permission #${permissionId} by hand. No blocked call came before it.`
    const detail = catalog.get(item.key)
    if (detail) hover(copy, detail.full)
    row.append(origin, copy)
    if (item.badge && isStatus(item.badge)) row.append(statusBadge(item.badge))
    body.append(row)
  }
  box.append(body)
  return box
}

function historyItems(model: ScreenModel): Hist[] {
  const items: Hist[] = []
  const seen = new Set<string>()
  const push = (detail: Detail, auto: boolean): void => {
    if (seen.has(detail.key)) return
    seen.add(detail.key)
    items.push({ key: detail.key, place: detail.place, line: detail.line, badge: detail.badge, auto })
  }
  for (const view of [model.account, ...model.agents]) {
    for (const row of view.permissions) {
      if (row.status !== 'REVOKED') continue
      const key = `perm:${row.tokenId.toString()}`
      if (watchedPermission(row.tokenId)) continue
      const detail = catalog.get(key)
      if (!detail) continue
      push(detail, false)
    }
  }
  for (const detail of catalog.values()) {
    if (detail.badge !== 'REVOKED') continue
    if (detail.key.startsWith('perm:') && watchedPermission(BigInt(detail.key.slice('perm:'.length)))) continue
    push(detail, false)
  }
  items.sort((left, right) => Number(right.auto) - Number(left.auto))
  return items
}

function isOpen(key: string, fallback: boolean): boolean {
  const stored = openState.get(key)
  return stored === undefined ? fallback : stored
}

function card(parent: HTMLElement, title: string, key: string, fallback: boolean, full: string | null, fill: (body: HTMLElement) => void): void {
  const open = isOpen(key, fallback)
  const section = document.createElement('section')
  section.className = open ? 'card' : 'card shut'
  const button = foldButton(title, null, key, fallback)
  if (full !== null) hover(button, full)
  section.append(button)
  const body = document.createElement('div')
  body.className = 'body'
  fill(body)
  section.append(body)
  parent.append(section)
}

function group<T>(parent: HTMLElement, title: string, owner: Address, rows: T[], renderRow: (host: HTMLElement, row: T) => void): void {
  const key = `${owner}:${title}`
  const open = isOpen(key, true)
  const box = document.createElement('div')
  box.className = open ? 'sec' : 'sec shut'
  box.append(foldButton(title, rows.length, key, true))
  const body = document.createElement('div')
  body.className = 'sec-body'
  if (rows.length === 0) line(body, 'none', 'sub')
  else for (const row of rows) renderRow(body, row)
  box.append(body)
  parent.append(box)
}

function foldButton(title: string, count: number | null, key: string, fallback: boolean): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'fold'
  const mark = document.createElement('span')
  mark.className = 'mark'
  mark.textContent = isOpen(key, fallback) ? '▾' : '▸'
  const name = document.createElement('span')
  name.className = 'fold-name'
  name.textContent = title
  button.append(mark, name)
  if (count !== null) {
    const tally = document.createElement('span')
    tally.className = 'count'
    tally.textContent = String(count)
    button.append(tally)
  }
  button.addEventListener('click', (event) => {
    event.stopPropagation()
    openState.set(key, !isOpen(key, fallback))
    actions?.refresh?.()
  })
  return button
}

function isStatus(value: string): value is PermissionStatus {
  switch (value) {
    case 'ACTIVE':
    case 'FROZEN':
    case 'REVOKED':
    case 'EXPIRED':
      return true
    default:
      return false
  }
}

function statusBadge(status: PermissionStatus): HTMLElement {
  const node = document.createElement('span')
  node.className = `badge ${statusClass(status)}`
  node.textContent = status
  return node
}

function actionButton(screen: HTMLElement, text: string, className: string, key: string, send: () => Promise<void>): HTMLButtonElement {
  const node = document.createElement('button')
  node.textContent = text
  node.className = busyKeys.has(key) ? (className ? `${className} busy` : 'busy') : className
  if (busyKeys.has(key)) node.disabled = true
  node.addEventListener('click', (event) => {
    event.stopPropagation()
    if (node.disabled || busyKeys.has(key)) return
    busyKeys.add(key)
    selectedKey = key
    actions?.refresh?.()
    void send()
      .then(() => {
        busyKeys.delete(key)
        sessionKeys.add(key)
        actions?.refresh?.()
      })
      .catch((error: unknown) => {
        busyKeys.delete(key)
        actions?.refresh?.()
        if (error instanceof Error && error.message === 'Not allowed') return
        const failed = document.createElement('p')
        failed.className = 'error'
        failed.textContent = 'Revoke failed'
        screen.prepend(failed)
      })
  })
  return node
}

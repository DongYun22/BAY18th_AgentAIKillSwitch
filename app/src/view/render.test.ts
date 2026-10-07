import { getAddress } from 'viem'
import { describe, expect, it } from 'vitest'
import type { PermissionRow, ScreenModel } from '../types'
import { renderAgents, setWatchEvents } from './render'

const cold = getAddress('0xB6AF02FeEA21e2960A7C14FAf97bAdbE2E982836')
const hot = getAddress('0x67f49213ae30080250467bbc2fc9495f9c58dca8')
const token = getAddress('0x0000000000000000000000000000000000000002')
const spender = getAddress('0x0000000000000000000000000000000000000004')

class NodeEl {
  readonly children: NodeEl[] = []
  private ownText = ''
  constructor(readonly tag: string) {}
  get textContent(): string {
    return this.ownText + this.children.map((child) => child.textContent).join('')
  }
  set textContent(value: string) {
    this.ownText = value
  }
  append(...nodes: NodeEl[]): void {
    this.children.push(...nodes)
  }
  prepend(node: NodeEl): void {
    this.children.unshift(node)
  }
  addEventListener(): void {}
  replaceChildren(): void {
    this.children.length = 0
  }
  querySelectorAll(selector: string): NodeEl[] {
    const found: NodeEl[] = []
    const walk = (node: NodeEl): void => {
      if (selector === 'button' && node.tag === 'button') found.push(node)
      node.children.forEach(walk)
    }
    walk(this)
    return found
  }
}

function collected(node: NodeEl): string {
  const titles: string[] = []
  const walk = (current: NodeEl): void => {
    const titled = current as NodeEl & { title?: string }
    if (titled.title) titles.push(titled.title)
    current.children.forEach(walk)
  }
  walk(node)
  return `${node.textContent}\n${titles.join('\n')}`
}

function installDocument(): void {
  const documentShim = {
    createElement(tag: string) {
      return new NodeEl(tag)
    },
  }
  Object.assign(globalThis, { document: documentShim })
}

function permission(tokenId: bigint, holder: typeof cold, parentId: bigint): PermissionRow {
  return { tokenId, holder, parentId, spendingLimit: 8n, allowlist: [], expiry: 10n, status: 'ACTIVE' }
}

function model(): ScreenModel {
  return {
    account: {
      agent: cold,
      permissions: [permission(1n, cold, 0n)],
      erc20: [],
      erc721: [],
      permit2: [],
      delegation: null,
      ens: [],
    },
    agents: [
      {
        agent: hot,
        permissions: [permission(2n, hot, 1n)],
        erc20: [{ owner: hot, token, spender, amount: 5n }],
        erc721: [],
        permit2: [],
        delegation: null,
        ens: [],
      },
    ],
  }
}

installDocument()

describe('K-T-9', () => {
  it('shows the agent, ACTIVE, the spender, and the two warnings', () => {
    const root = new NodeEl('div') as unknown as HTMLElement
    renderAgents(root, model())
    const text = collected(root as unknown as NodeEl)
    expect(text).toContain(hot)
    expect(text).toContain('ACTIVE')
    expect(text).toContain(spender)
    expect(text).toContain('This approval stays until the agent key signs.')
    expect(text).toContain('Revoking the agent does not clear this approval.')
    expect(text).toContain('Revoke agent')
  })

  it('shows Account and No agents for an empty list', () => {
    const root = new NodeEl('div') as unknown as HTMLElement
    renderAgents(root, { ...model(), agents: [] })
    const text = collected(root as unknown as NodeEl)
    expect(text).toContain('Account')
    expect(text).toContain('No agents for this account')
  })
})

describe('K-T-10', () => {
  it('labels a child Revoke agent and a root Revoke', () => {
    const root = new NodeEl('div') as unknown as HTMLElement
    renderAgents(root, model())
    const labels = (root as unknown as NodeEl).querySelectorAll('button').map((node) => node.textContent)
    expect(labels).toContain('Revoke')
    expect(labels).toContain('Revoke agent')
  })
})

describe('revoke history', () => {
  it('keeps a revoked allowance on the row and drops its button', () => {
    const root = new NodeEl('div') as unknown as HTMLElement
    const screen = model()
    screen.agents[0].erc20.push({ owner: hot, token, spender, amount: 9n, revoked: true })
    screen.account.delegation = spender
    screen.account.delegationRevoked = true
    renderAgents(root, screen)
    const text = collected(root as unknown as NodeEl)
    expect(text).toContain(`${token} ${spender} 9`)
    expect(text).toContain('REVOKED')
    expect(text).toContain(spender)
    const labels = (root as unknown as NodeEl).querySelectorAll('button').map((node) => node.textContent)
    expect(labels.filter((label) => label === 'Revoke')).toEqual(['Revoke'])
  })
})

describe('auto response', () => {
  it('shows the blocked target on the revoked permission', () => {
    const root = new NodeEl('div') as unknown as HTMLElement
    const screen = model()
    screen.agents[0].permissions[0].status = 'REVOKED'
    setWatchEvents([
      {
        level: 'EXEC',
        actor: 'Hot Agent',
        detail: 'P#2 → 0x00000000000000000000000000000000000000b1 · 0.0001 ETH',
        note: 'target not in allowlist',
        result: 'BLOCKED',
        seconds: null,
      },
      {
        level: 'KILL',
        actor: 'Owner',
        detail: 'Permission #2 revoke',
        note: '',
        result: 'REVOKED',
        seconds: 2,
      },
    ])
    renderAgents(root, screen)
    const text = collected(root as unknown as NodeEl)
    expect(text).toContain('That address is not on the allowlist, so the call was blocked.')
    expect(text).toContain('The watcher revoked this permission 2s later.')
    setWatchEvents([])
  })
})

describe('v2 freeze', () => {
  const frozenCall = {
    level: 'EXEC' as const,
    actor: 'Hot Agent',
    detail: 'P#2 → 0x00000000000000000000000000000000000000b1 · 0.0001 ETH',
    note: 'target not in allowlist',
    result: 'FROZEN' as const,
    seconds: null,
  }

  it('says the wallet froze the permission in the blocked transaction', () => {
    const root = new NodeEl('div') as unknown as HTMLElement
    const screen = model()
    screen.agents[0].permissions[0].status = 'FROZEN'
    setWatchEvents([frozenCall])
    renderAgents(root, screen)
    const text = collected(root as unknown as NodeEl)
    expect(text).toContain('That address is not on the allowlist, so the call was blocked.')
    expect(text).toContain('The wallet froze this permission in the same transaction.')
    expect(text).toContain('It stays frozen until the owner unfreezes or revokes it.')
    expect(text).not.toContain('This permission is still active.')
    setWatchEvents([])
  })

  it('adds the later revoke when the watcher escalates the freeze', () => {
    const root = new NodeEl('div') as unknown as HTMLElement
    const screen = model()
    screen.agents[0].permissions[0].status = 'REVOKED'
    setWatchEvents([
      frozenCall,
      { level: 'KILL', actor: 'Owner', detail: 'Permission #2 revoke', note: '', result: 'REVOKED', seconds: 2 },
    ])
    renderAgents(root, screen)
    const text = collected(root as unknown as NodeEl)
    expect(text).toContain('The wallet froze this permission in the same transaction.')
    expect(text).toContain('The watcher revoked this permission 2s later.')
    setWatchEvents([])
  })
})

describe('K-T-11', () => {
  it('shows the warnings and Revoke agent for an allowance cold does not own', () => {
    const root = new NodeEl('div') as unknown as HTMLElement
    renderAgents(root, model())
    const text = collected(root as unknown as NodeEl)
    expect(text).toContain('This approval stays until the agent key signs.')
    expect(text).toContain('Revoking the agent does not clear this approval.')
    expect(text).toContain('Revoke agent')
  })
})

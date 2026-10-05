import { getAddress } from 'viem'
import { describe, expect, it } from 'vitest'
import type { PermissionRow, ScreenModel } from '../types'
import { renderAgents } from './render'

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
    const text = (root as unknown as NodeEl).textContent
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
    const text = (root as unknown as NodeEl).textContent
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

describe('K-T-11', () => {
  it('shows the warnings and Revoke agent for an allowance cold does not own', () => {
    const root = new NodeEl('div') as unknown as HTMLElement
    renderAgents(root, model())
    const text = (root as unknown as NodeEl).textContent
    expect(text).toContain('This approval stays until the agent key signs.')
    expect(text).toContain('Revoking the agent does not clear this approval.')
    expect(text).toContain('Revoke agent')
  })
})

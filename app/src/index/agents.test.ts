import { getAddress } from 'viem'
import { describe, expect, it } from 'vitest'
import type { PermissionRow } from '../types'
import { groupAgents } from './agents'

const cold = getAddress('0xB6AF02FeEA21e2960A7C14FAf97bAdbE2E982836')
const agentA = getAddress('0x00000000000000000000000000000000000000a1')
const agentB = getAddress('0x00000000000000000000000000000000000000b1')

function row(tokenId: bigint, holder: typeof cold, parentId: bigint): PermissionRow {
  return {
    tokenId,
    holder,
    parentId,
    spendingLimit: 1n,
    allowlist: [],
    expiry: 10n,
    status: 'ACTIVE',
  }
}

describe('K-T-4', () => {
  it('groups children and leaves cold out of the groups', () => {
    const indexed = groupAgents(cold, [
      row(1n, cold, 0n),
      row(2n, agentA, 1n),
      row(3n, agentA, 1n),
      row(4n, agentB, 1n),
    ])
    expect(indexed.groups).toHaveLength(2)
    expect(indexed.roots).toHaveLength(1)
    expect(indexed.groups.find((group) => group.agent === agentA)?.permissions).toHaveLength(2)
    expect(indexed.groups.some((group) => group.agent === cold)).toBe(false)
  })
})

import { getAddress, type Address } from 'viem'
import { describe, expect, it } from 'vitest'
import { ensRegistry } from '../abi/ensV2'
import type { ChainLog, ReadClient } from '../types'
import { indexEnsRoles } from './ensV2'

const cold = getAddress('0xB6AF02FeEA21e2960A7C14FAf97bAdbE2E982836')
const agent = getAddress('0x67f49213ae30080250467bbc2fc9495f9c58dca8')
const otherRegistry = getAddress('0x00000000000000000000000000000000000000aa')

function log(resource: bigint, account: Address, bitmap: bigint, logIndex: number, registry: Address = ensRegistry): ChainLog {
  return {
    address: registry,
    blockNumber: 1n,
    logIndex,
    args: { resource, account, oldRoleBitmap: 0n, newRoleBitmap: bitmap },
  }
}

function client(logs: ChainLog[], admin: boolean): ReadClient {
  return {
    async getBlockNumber() {
      return 10n
    },
    async getBlock() {
      return { timestamp: 1n }
    },
    async getLogs() {
      return logs
    },
    async getCode() {
      return '0x'
    },
    async readContract() {
      return admin
    },
  }
}

describe('K-T-17', () => {
  it('keeps an active role and drops a later zero bitmap and another registry', async () => {
    const rows = await indexEnsRoles(
      client([
        log(4n, agent, 1n, 1),
        log(4n, agent, 0n, 2),
        log(9n, agent, 1n, 3, otherRegistry),
        log(2n, agent, 1n, 4),
      ], true),
      cold,
      [agent],
    )
    expect(rows.map((row) => row.resource)).toEqual([2n])
    expect(rows[0]?.registry).toBe(ensRegistry)
    expect(rows[0]?.revocable).toBe(true)
  })

  it('a non-admin role on an unknown account is absent', async () => {
    const rows = await indexEnsRoles(client([log(3n, agent, 1n, 1)], false), cold, [])
    expect(rows).toEqual([])
  })
})

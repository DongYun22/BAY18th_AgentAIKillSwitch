import { getAddress, type Address } from 'viem'
import { describe, expect, it } from 'vitest'
import { config } from '../config'
import type { ChainLog, ReadClient } from '../types'
import { indexPermissions } from './permissionToken'

const cold = getAddress('0xB6AF02FeEA21e2960A7C14FAf97bAdbE2E982836')
const hot = getAddress('0x67f49213ae30080250467bbc2fc9495f9c58dca8')
const other = getAddress('0x1111111111111111111111111111111111111111')

function client(input: {
  logs: ChainLog[]
  owners: Record<string, Address | 'revert'>
  policies: Record<string, { spendingLimit: bigint; allowlist: Address[]; expiry: bigint }>
  valid: Record<string, boolean>
  timestamp: bigint
  failLogs?: boolean
}): ReadClient {
  return {
    async getBlockNumber() {
      return 10n
    },
    async getBlock() {
      return { timestamp: input.timestamp }
    },
    async getLogs() {
      if (input.failLogs) throw new Error('rpc')
      return input.logs
    },
    async getCode() {
      return '0x'
    },
    async readContract(args) {
      const id = String(args.args?.[0])
      if (args.functionName === 'ownerOf') {
        const owner = input.owners[id]
        if (owner === undefined || owner === 'revert') throw new Error('revert')
        return owner
      }
      if (args.functionName === 'getPolicy') return input.policies[id]
      if (args.functionName === 'isValid') return input.valid[id] ?? true
      throw new Error('missing')
    },
  }
}

function mint(tokenId: bigint, to: Address, parentId: bigint): ChainLog {
  return {
    address: config.permissionToken,
    blockNumber: 1n,
    logIndex: Number(tokenId),
    args: { tokenId, to, parentId },
  }
}

describe('K-T-3', () => {
  it('keeps a root minted to cold', async () => {
    const rows = await indexPermissions(
      client({
        logs: [mint(1n, cold, 0n)],
        owners: { '1': cold },
        policies: { '1': { spendingLimit: 5n, allowlist: [], expiry: 5_000n } },
        valid: { '1': true },
        timestamp: 1_000n,
      }),
      cold,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]?.status).toBe('ACTIVE')
    expect(rows[0]?.holder).toBe(cold)
  })

  it('keeps a child whose parent cold owns', async () => {
    const rows = await indexPermissions(
      client({
        logs: [mint(2n, hot, 1n)],
        owners: { '1': cold, '2': hot },
        policies: { '2': { spendingLimit: 4n, allowlist: [], expiry: 5_000n } },
        valid: { '2': true },
        timestamp: 1_000n,
      }),
      cold,
    )
    expect(rows).toEqual([
      expect.objectContaining({ tokenId: 2n, holder: hot, parentId: 1n, status: 'ACTIVE' }),
    ])
  })

  it('drops a mint whose parent owner is someone else', async () => {
    const rows = await indexPermissions(
      client({
        logs: [mint(3n, hot, 9n)],
        owners: { '9': other, '3': hot },
        policies: { '3': { spendingLimit: 1n, allowlist: [], expiry: 5_000n } },
        valid: {},
        timestamp: 1_000n,
      }),
      cold,
    )
    expect(rows).toEqual([])
  })

  it('keeps getPolicy spending limit when the child ownerOf reverts', async () => {
    const rows = await indexPermissions(
      client({
        logs: [mint(4n, hot, 1n)],
        owners: { '1': cold, '4': 'revert' },
        policies: { '4': { spendingLimit: 9n, allowlist: [], expiry: 5_000n } },
        valid: {},
        timestamp: 1_000n,
      }),
      cold,
    )
    expect(rows[0]?.status).toBe('REVOKED')
    expect(rows[0]?.spendingLimit).toBe(9n)
  })

  it('marks expiry equal to the block timestamp as EXPIRED even when frozen', async () => {
    const rows = await indexPermissions(
      client({
        logs: [mint(5n, cold, 0n)],
        owners: { '5': cold },
        policies: { '5': { spendingLimit: 1n, allowlist: [], expiry: 1_000n } },
        valid: { '5': false },
        timestamp: 1_000n,
      }),
      cold,
    )
    expect(rows[0]?.status).toBe('EXPIRED')
  })

  it('marks a future expiry with isValid false as FROZEN', async () => {
    const rows = await indexPermissions(
      client({
        logs: [mint(6n, cold, 0n)],
        owners: { '6': cold },
        policies: { '6': { spendingLimit: 1n, allowlist: [], expiry: 9_000n } },
        valid: { '6': false },
        timestamp: 1_000n,
      }),
      cold,
    )
    expect(rows[0]?.status).toBe('FROZEN')
  })
})

import { getAddress } from 'viem'
import { describe, expect, it } from 'vitest'
import type { ChainLog, PermissionRow, ReadClient } from '../types'
import { indexViolations } from './violations'

const hot = getAddress('0x00000000000000000000000000000000000000a1')
const merchant = getAddress('0x000000000000000000000000000000000000dEaD')
const outside = getAddress('0x000000000000000000000000000000000000bEEF')
const wallet = getAddress('0x0000000000000000000000000000000000000009')

function row(tokenId: bigint): PermissionRow {
  return { tokenId, holder: hot, parentId: 1n, spendingLimit: 800n, allowlist: [merchant], expiry: 10n, status: 'FROZEN' }
}

function log(tokenId: bigint, target: typeof hot, value: bigint, blockNumber: bigint): ChainLog {
  return { address: wallet, blockNumber, logIndex: 0, args: { tokenId, target, value } }
}

function client(logs: ChainLog[]): ReadClient {
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
    async readContract() {
      return null
    },
    async getCode() {
      return '0x'
    },
  }
}

describe('v2 violations', () => {
  it('turns a PolicyViolation into a frozen blocked call for that permission', async () => {
    const events = await indexViolations(client([log(2n, outside, 300000000000000n, 5n)]), [row(2n), row(3n)])
    expect(events).toEqual([
      {
        level: 'EXEC',
        actor: 'Hot Agent',
        detail: `P#2 → ${outside} · 0.0003 ETH`,
        note: 'target not in allowlist',
        result: 'FROZEN',
        seconds: null,
      },
    ])
  })

  it('keeps the latest one and names an over-limit spend at an allowed address', async () => {
    const events = await indexViolations(
      client([log(2n, outside, 1n, 5n), log(2n, merchant, 900n, 6n)]),
      [row(2n)],
    )
    expect(events.length).toBe(1)
    expect(events[0].detail).toContain(merchant)
    expect(events[0].note).toBe('That amount is over the spending limit, so the call was blocked.')
  })
})

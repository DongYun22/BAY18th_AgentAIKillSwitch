import { getAddress, type Address } from 'viem'
import { describe, expect, it } from 'vitest'
import { config } from '../config'
import type { ChainLog, ReadClient } from '../types'
import { indexPermit2Allowances } from './permit2'

const agent = getAddress('0x00000000000000000000000000000000000000a1')
const other = getAddress('0x00000000000000000000000000000000000000b1')
const token = getAddress('0x0000000000000000000000000000000000000002')
const spender = getAddress('0x0000000000000000000000000000000000000004')

function log(owner: Address, amount: bigint, expiration: bigint): ChainLog {
  return {
    address: config.permit2,
    blockNumber: 1n,
    logIndex: 1,
    args: { owner, token, spender, amount, expiration },
  }
}

function client(logs: ChainLog[], amount: bigint, expiration: bigint, timestamp: bigint): ReadClient {
  return {
    async getBlockNumber() {
      return 10n
    },
    async getBlock() {
      return { timestamp }
    },
    async getLogs(args) {
      return logs.filter((item) => item.args.owner === args.args?.owner)
    },
    async getCode() {
      return '0x'
    },
    async readContract() {
      return { amount, expiration, nonce: 0n }
    },
  }
}

describe('K-T-7', () => {
  it('keeps amount 10 and a future expiration', async () => {
    const rows = await indexPermit2Allowances(client([log(agent, 10n, 50n)], 10n, 50n, 10n), [agent])
    expect(rows).toHaveLength(1)
  })

  it('drops amount 0', async () => {
    const rows = await indexPermit2Allowances(client([log(agent, 0n, 50n)], 0n, 50n, 10n), [agent])
    expect(rows).toEqual([])
  })

  it('drops an expiration equal to the block timestamp', async () => {
    const rows = await indexPermit2Allowances(client([log(agent, 10n, 10n)], 10n, 10n, 10n), [agent])
    expect(rows).toEqual([])
  })

  it('drops another owner', async () => {
    const rows = await indexPermit2Allowances(client([log(other, 10n, 50n)], 10n, 50n, 10n), [agent])
    expect(rows).toEqual([])
  })
})

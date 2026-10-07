import { getAddress, type Address } from 'viem'
import { describe, expect, it } from 'vitest'
import type { ChainLog, ReadClient } from '../types'
import { indexErc721Operators } from './erc721'

const agent = getAddress('0x00000000000000000000000000000000000000a1')
const other = getAddress('0x00000000000000000000000000000000000000b1')
const token = getAddress('0x0000000000000000000000000000000000000002')
const operator = getAddress('0x0000000000000000000000000000000000000004')

function log(owner: Address, approved: boolean, logIndex: number): ChainLog {
  return { address: token, blockNumber: 1n, logIndex, args: { owner, operator, approved } }
}

function client(logs: ChainLog[], live: boolean): ReadClient {
  return {
    async getBlockNumber() {
      return 10n
    },
    async getBlock() {
      return { timestamp: 1n }
    },
    async getLogs(args) {
      return logs.filter((item) => item.args.owner === args.args?.owner)
    },
    async getCode() {
      return '0x'
    },
    async readContract() {
      return live
    },
  }
}

describe('K-T-6', () => {
  it('keeps a live approval', async () => {
    const rows = await indexErc721Operators(client([log(agent, true, 1)], true), [agent])
    expect(rows).toHaveLength(1)
    expect(rows[0]?.approved).toBe(true)
  })

  it('drops a later false approval', async () => {
    const rows = await indexErc721Operators(client([log(agent, true, 1), log(agent, false, 2)], false), [agent])
    expect(rows).toEqual([])
  })

  it('drops another owner', async () => {
    const rows = await indexErc721Operators(client([log(other, true, 1)], true), [agent])
    expect(rows).toEqual([])
  })
})

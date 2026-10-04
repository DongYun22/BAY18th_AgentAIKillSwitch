import { getAddress, type Address } from 'viem'
import { describe, expect, it } from 'vitest'
import type { ChainLog, ReadClient } from '../types'
import { indexErc20Allowances } from './erc20'

const agent = getAddress('0x00000000000000000000000000000000000000a1')
const other = getAddress('0x00000000000000000000000000000000000000b1')
const tokenA = getAddress('0x0000000000000000000000000000000000000002')
const tokenB = getAddress('0x0000000000000000000000000000000000000003')
const spender = getAddress('0x0000000000000000000000000000000000000004')

function log(owner: Address, token: Address, value: bigint, logIndex: number): ChainLog {
  return { address: token, blockNumber: 1n, logIndex, args: { owner, spender, value } }
}

function client(logs: ChainLog[], allowances: Record<string, bigint | 'revert'>): ReadClient {
  return {
    async getBlockNumber() {
      return 10n
    },
    async getBlock() {
      return { timestamp: 1n }
    },
    async getLogs(args) {
      if (allowances.fail === 0n) throw new Error('rpc')
      return logs.filter((item) => item.args.owner === args.args?.owner)
    },
    async getCode() {
      return '0x'
    },
    async readContract(args) {
      const token = getAddress(args.address)
      const amount = allowances[token]
      if (amount === undefined || amount === 'revert') throw new Error('revert')
      return amount
    },
  }
}

describe('K-T-5', () => {
  it('keeps a live amount', async () => {
    const rows = await indexErc20Allowances(client([log(agent, tokenA, 5n, 1)], { [tokenA]: 5n }), [agent])
    expect(rows).toEqual([expect.objectContaining({ amount: 5n, token: tokenA })])
  })

  it('drops a later zero allowance', async () => {
    const rows = await indexErc20Allowances(
      client([log(agent, tokenA, 5n, 1), log(agent, tokenA, 0n, 2)], { [tokenA]: 0n }),
      [agent],
    )
    expect(rows).toEqual([])
  })

  it('keeps two tokens', async () => {
    const rows = await indexErc20Allowances(
      client([log(agent, tokenB, 2n, 1), log(agent, tokenA, 3n, 2)], { [tokenA]: 3n, [tokenB]: 2n }),
      [agent],
    )
    expect(rows.map((row) => row.token)).toEqual([tokenA, tokenB])
  })

  it('drops another owner', async () => {
    const rows = await indexErc20Allowances(client([log(other, tokenA, 5n, 1)], { [tokenA]: 5n }), [agent])
    expect(rows).toEqual([])
  })

  it('throws Log scan failed', async () => {
    const broken = client([], { fail: 0n })
    await expect(indexErc20Allowances(broken, [agent])).rejects.toThrow('Log scan failed')
  })
})

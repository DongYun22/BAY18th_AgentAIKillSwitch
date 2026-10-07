import { getAddress } from 'viem'
import { describe, expect, it } from 'vitest'
import type { Erc20Allowance, Sender } from '../types'
import { revokeErc20 } from './erc20'

const owner = getAddress('0xB6AF02FeEA21e2960A7C14FAf97bAdbE2E982836')
const other = getAddress('0x67f49213ae30080250467bbc2fc9495f9c58dca8')
const token = getAddress('0x0000000000000000000000000000000000000002')
const spender = getAddress('0x0000000000000000000000000000000000000004')

function row(account: typeof owner): Erc20Allowance {
  return { owner: account, token, spender, amount: 5n }
}

function sender(account: typeof owner): Sender & { writes: (readonly unknown[])[] } {
  const writes: (readonly unknown[])[] = []
  return {
    chainId: 11155111,
    account,
    writes,
    async writeContract(args) {
      writes.push(args.args)
      return '0x1'
    },
    async waitForTransactionReceipt() {
      return { status: 'success' }
    },
  }
}

describe('K-T-11', () => {
  it('encodes approve(spender, 0) for the owner and sends 0 for another owner', async () => {
    const allowed = sender(owner)
    await revokeErc20(allowed, owner, row(owner))
    expect(allowed.writes).toEqual([[spender, 0n]])
    const blocked = sender(owner)
    await expect(revokeErc20(blocked, owner, row(other))).rejects.toThrow('Not allowed')
    expect(blocked.writes).toEqual([])
  })
})

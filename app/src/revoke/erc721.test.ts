import { getAddress } from 'viem'
import { describe, expect, it } from 'vitest'
import type { Erc721Operator, Sender } from '../types'
import { revokeErc721 } from './erc721'

const owner = getAddress('0xB6AF02FeEA21e2960A7C14FAf97bAdbE2E982836')
const other = getAddress('0x67f49213ae30080250467bbc2fc9495f9c58dca8')
const token = getAddress('0x0000000000000000000000000000000000000002')
const operator = getAddress('0x0000000000000000000000000000000000000004')

function row(account: typeof owner): Erc721Operator {
  return { owner: account, token, operator, approved: true }
}

function sender(): Sender & { writes: (readonly unknown[])[] } {
  const writes: (readonly unknown[])[] = []
  return {
    chainId: 11155111,
    account: owner,
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

describe('K-T-14', () => {
  it('encodes setApprovalForAll(operator, false) and sends 0 for another owner', async () => {
    const allowed = sender()
    await revokeErc721(allowed, owner, row(owner))
    expect(allowed.writes).toEqual([[operator, false]])
    const blocked = sender()
    await expect(revokeErc721(blocked, owner, row(other))).rejects.toThrow('Not allowed')
    expect(blocked.writes).toEqual([])
  })
})

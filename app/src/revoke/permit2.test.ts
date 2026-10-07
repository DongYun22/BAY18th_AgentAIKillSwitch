import { getAddress } from 'viem'
import { describe, expect, it } from 'vitest'
import { config } from '../config'
import type { Permit2Allowance, Sender } from '../types'
import { revokePermit2 } from './permit2'

const owner = getAddress('0xB6AF02FeEA21e2960A7C14FAf97bAdbE2E982836')
const other = getAddress('0x67f49213ae30080250467bbc2fc9495f9c58dca8')
const token = getAddress('0x0000000000000000000000000000000000000002')
const spender = getAddress('0x0000000000000000000000000000000000000004')

function row(account: typeof owner): Permit2Allowance {
  return { owner: account, token, spender, amount: 5n, expiration: 20n }
}

function sender(): Sender & { writes: { to: string; args: readonly unknown[] }[] } {
  const writes: { to: string; args: readonly unknown[] }[] = []
  return {
    chainId: 11155111,
    account: owner,
    writes,
    async writeContract(args) {
      writes.push({ to: args.address, args: args.args })
      return '0x1'
    },
    async waitForTransactionReceipt() {
      return { status: 'success' }
    },
  }
}

describe('K-T-15', () => {
  it('encodes Permit2 approve to config.permit2 and sends 0 for another owner', async () => {
    const allowed = sender()
    await revokePermit2(allowed, owner, row(owner))
    expect(allowed.writes).toEqual([{ to: config.permit2, args: [token, spender, 0n, 0n] }])
    const blocked = sender()
    await expect(revokePermit2(blocked, owner, row(other))).rejects.toThrow('Not allowed')
    expect(blocked.writes).toEqual([])
  })
})

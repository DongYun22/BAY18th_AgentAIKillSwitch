import { getAddress } from 'viem'
import { describe, expect, it } from 'vitest'
import type { Sender } from '../types'
import { clearDelegation, trackAuth } from './delegation7702'

const agent = getAddress('0xB6AF02FeEA21e2960A7C14FAf97bAdbE2E982836')
const other = getAddress('0x67f49213ae30080250467bbc2fc9495f9c58dca8')
const zero = getAddress('0x0000000000000000000000000000000000000000')

function base(account: typeof agent): Sender {
  return {
    chainId: 11155111,
    account,
    async writeContract() {
      return '0x1'
    },
    async waitForTransactionReceipt() {
      return { status: 'success' }
    },
  }
}

describe('K-T-16', () => {
  it('clears the matching account to the zero address and skips another account', async () => {
    const matched = trackAuth(base(agent))
    await clearDelegation(matched, agent)
    expect(matched.authCalls).toBe(1)
    expect(matched.lastContract).toBe(zero)
    const skipped = trackAuth(base(agent))
    await expect(clearDelegation(skipped, other)).rejects.toThrow('Not allowed')
    expect(skipped.authCalls).toBe(0)
  })

  it('throws Revoke failed when the wallet cannot authorize', async () => {
    await expect(clearDelegation(base(agent), agent)).rejects.toThrow('Revoke failed')
  })
})

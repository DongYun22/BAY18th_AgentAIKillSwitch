import { getAddress } from 'viem'
import { describe, expect, it } from 'vitest'
import type { PermissionRow, Sender } from '../types'
import { canRevokePermission, revokePermission } from './permissionToken'

const cold = getAddress('0xB6AF02FeEA21e2960A7C14FAf97bAdbE2E982836')
const hot = getAddress('0x67f49213ae30080250467bbc2fc9495f9c58dca8')

function row(parentId: bigint, holder: typeof cold, status: PermissionRow['status'] = 'ACTIVE'): PermissionRow {
  return { tokenId: parentId === 0n ? 1n : 2n, holder, parentId, spendingLimit: 1n, allowlist: [], expiry: 10n, status }
}

function sender(): Sender & { writes: string[] } {
  const writes: string[] = []
  return {
    chainId: 11155111,
    account: cold,
    writes,
    async writeContract(args) {
      writes.push(args.functionName)
      return '0x1'
    },
    async waitForTransactionReceipt() {
      return { status: 'success' }
    },
  }
}

describe('K-T-10', () => {
  it('allows a root held by cold and rejects the other three cases', () => {
    expect(canRevokePermission(cold, row(0n, cold), null)).toBe(true)
    expect(canRevokePermission(cold, row(0n, hot), null)).toBe(false)
    expect(canRevokePermission(cold, row(1n, hot), cold)).toBe(true)
    expect(canRevokePermission(cold, row(1n, hot), hot)).toBe(false)
  })

  it('encodes revoke and sends nothing when the check is false', async () => {
    const allowed = sender()
    await revokePermission(allowed, cold, row(0n, cold), null)
    expect(allowed.writes).toEqual(['revoke'])
    const blocked = sender()
    await expect(revokePermission(blocked, cold, row(0n, hot), null)).rejects.toThrow('Not allowed')
    expect(blocked.writes).toEqual([])
  })
})

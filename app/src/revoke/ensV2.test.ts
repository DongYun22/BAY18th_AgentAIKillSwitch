import { getAddress } from 'viem'
import { describe, expect, it } from 'vitest'
import { ensRegistry } from '../abi/ensV2'
import type { EnsRole, Sender } from '../types'
import { revokeEnsRole } from './ensV2'

const agent = getAddress('0x67f49213ae30080250467bbc2fc9495f9c58dca8')
const admin = getAddress('0xB6AF02FeEA21e2960A7C14FAf97bAdbE2E982836')

function role(revocable: boolean, resource = 7n): EnsRole {
  return { registry: ensRegistry, resource, agent, roleBitmap: 1n, revocable }
}

function sender(): Sender & { writes: { name: string; args: readonly unknown[] }[] } {
  const writes: { name: string; args: readonly unknown[] }[] = []
  return {
    chainId: 11155111,
    account: admin,
    writes,
    async writeContract(args) {
      writes.push({ name: args.functionName, args: args.args })
      return '0x1'
    },
    async waitForTransactionReceipt() {
      return { status: 'success' }
    },
  }
}

describe('K-T-17', () => {
  it('encodes revokeRoles for the admin and sends nothing for a non-admin', async () => {
    const allowed = sender()
    await revokeEnsRole(allowed, role(true))
    expect(allowed.writes).toEqual([{ name: 'revokeRoles', args: [7n, 1n, agent] }])
    const blocked = sender()
    await expect(revokeEnsRole(blocked, role(false))).rejects.toThrow('Not allowed')
    expect(blocked.writes).toEqual([])
  })

  it('encodes revokeRootRoles when the resource is zero', async () => {
    const allowed = sender()
    await revokeEnsRole(allowed, role(true, 0n))
    expect(allowed.writes).toEqual([{ name: 'revokeRootRoles', args: [1n, agent] }])
  })
})

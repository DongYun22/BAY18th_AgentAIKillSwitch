import { ensAbi, ensRegistry } from '../abi/ensV2'
import type { EnsRole, Sender } from '../types'
import { sameAddress } from '../types'
import { assertChain } from '../wallet'

export function canRevokeEnsRole(row: EnsRole): boolean {
  return row.revocable && row.roleBitmap > 0n && sameAddress(row.registry, ensRegistry)
}

export async function revokeEnsRole(sender: Sender, row: EnsRole): Promise<void> {
  assertChain(sender.chainId)
  if (!canRevokeEnsRole(row)) throw new Error('Not allowed')
  const root = row.resource === 0n
  const hash = await sender.writeContract({
    address: ensRegistry,
    abi: ensAbi,
    functionName: root ? 'revokeRootRoles' : 'revokeRoles',
    args: root ? [row.roleBitmap, row.agent] : [row.resource, row.roleBitmap, row.agent],
  })
  const receipt = await sender.waitForTransactionReceipt({ hash })
  if (receipt.status !== 'success') throw new Error('Revoke failed')
}

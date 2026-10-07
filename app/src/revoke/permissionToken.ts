import { getAddress, type Address } from 'viem'
import { permissionTokenAbi } from '../abi/permissionToken'
import { config } from '../config'
import type { PermissionRow, Sender } from '../types'
import { sameAddress } from '../types'
import { assertChain } from '../wallet'

export function parentOwnerFrom(owner: Address | null): Address | null {
  if (owner === null) return null
  return getAddress(owner)
}

export function canRevokePermission(cold: Address, row: PermissionRow, parentOwner: Address | null): boolean {
  if (row.status === 'REVOKED') return false
  if (row.parentId === 0n) return sameAddress(row.holder, cold)
  return parentOwner !== null && sameAddress(parentOwner, cold)
}

export async function revokePermission(
  sender: Sender,
  cold: Address,
  row: PermissionRow,
  parentOwner: Address | null,
): Promise<void> {
  assertChain(sender.chainId)
  if (!canRevokePermission(cold, row, parentOwner)) throw new Error('Not allowed')
  const hash = await sender.writeContract({
    address: config.permissionToken,
    abi: permissionTokenAbi,
    functionName: 'revoke',
    args: [row.tokenId],
  })
  const receipt = await sender.waitForTransactionReceipt({ hash })
  if (receipt.status !== 'success') throw new Error('Revoke failed')
}

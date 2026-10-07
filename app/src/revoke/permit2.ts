import type { Address } from 'viem'
import { permit2Abi } from '../abi/permit2'
import { config } from '../config'
import type { Permit2Allowance, Sender } from '../types'
import { sameAddress } from '../types'
import { assertChain } from '../wallet'

export function canRevokePermit2(connected: Address, row: Permit2Allowance): boolean {
  return sameAddress(connected, row.owner)
}

export async function revokePermit2(sender: Sender, connected: Address, row: Permit2Allowance): Promise<void> {
  assertChain(sender.chainId)
  if (!canRevokePermit2(connected, row)) throw new Error('Not allowed')
  const hash = await sender.writeContract({
    address: config.permit2,
    abi: permit2Abi,
    functionName: 'approve',
    args: [row.token, row.spender, 0n, 0n],
  })
  const receipt = await sender.waitForTransactionReceipt({ hash })
  if (receipt.status !== 'success') throw new Error('Revoke failed')
}

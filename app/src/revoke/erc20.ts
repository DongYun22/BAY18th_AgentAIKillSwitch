import type { Address } from 'viem'
import { erc20Abi } from '../abi/permit2'
import type { Erc20Allowance, Sender } from '../types'
import { sameAddress } from '../types'
import { assertChain } from '../wallet'

export function canRevokeErc20(connected: Address, row: Erc20Allowance): boolean {
  return sameAddress(connected, row.owner) && row.amount > 0n
}

export async function revokeErc20(sender: Sender, connected: Address, row: Erc20Allowance): Promise<void> {
  assertChain(sender.chainId)
  if (!canRevokeErc20(connected, row)) throw new Error('Not allowed')
  const hash = await sender.writeContract({
    address: row.token,
    abi: erc20Abi,
    functionName: 'approve',
    args: [row.spender, 0n],
  })
  const receipt = await sender.waitForTransactionReceipt({ hash })
  if (receipt.status !== 'success') throw new Error('Revoke failed')
}

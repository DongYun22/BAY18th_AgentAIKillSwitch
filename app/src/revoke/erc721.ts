import type { Address } from 'viem'
import { erc721Abi } from '../abi/permit2'
import type { Erc721Operator, Sender } from '../types'
import { sameAddress } from '../types'
import { assertChain } from '../wallet'

export function canRevokeErc721(connected: Address, row: Erc721Operator): boolean {
  return sameAddress(connected, row.owner)
}

export async function revokeErc721(sender: Sender, connected: Address, row: Erc721Operator): Promise<void> {
  assertChain(sender.chainId)
  if (!canRevokeErc721(connected, row)) throw new Error('Not allowed')
  const hash = await sender.writeContract({
    address: row.token,
    abi: erc721Abi,
    functionName: 'setApprovalForAll',
    args: [row.operator, false],
  })
  const receipt = await sender.waitForTransactionReceipt({ hash })
  if (receipt.status !== 'success') throw new Error('Revoke failed')
}

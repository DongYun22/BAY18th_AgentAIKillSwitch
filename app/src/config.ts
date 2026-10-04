export function readFromBlock(value: string | undefined): number {
  if (value === undefined || !/^[0-9]+$/.test(value)) {
    throw new Error('Missing VITE_FROM_BLOCK')
  }
  return Number(value)
}

export const config = {
  chainId: 11155111,
  permissionToken: '0xA09511600787d4BF40A49CE3501af2C23d737584',
  agentWallet: '0x0B26b3d6500E8Cf03189042b3341d5be7774d29F',
  permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
  fromBlock: readFromBlock(import.meta.env.VITE_FROM_BLOCK),
  logChunk: 50_000,
} as const

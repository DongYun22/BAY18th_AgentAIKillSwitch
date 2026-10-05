export const ensRegistry = '0xD4eBcbBdF463C9c45784603Db0dDD499BC44A8B4' as const

export const ensAbi = [
  {
    type: 'event',
    name: 'EACRolesChanged',
    inputs: [
      { name: 'resource', type: 'uint256', indexed: true },
      { name: 'account', type: 'address', indexed: true },
      { name: 'oldRoleBitmap', type: 'uint256', indexed: false },
      { name: 'newRoleBitmap', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'function',
    name: 'hasRoles',
    stateMutability: 'view',
    inputs: [
      { name: 'resource', type: 'uint256' },
      { name: 'roleBitmap', type: 'uint256' },
      { name: 'account', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'hasRootRoles',
    stateMutability: 'view',
    inputs: [
      { name: 'roleBitmap', type: 'uint256' },
      { name: 'account', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'revokeRoles',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'resource', type: 'uint256' },
      { name: 'roleBitmap', type: 'uint256' },
      { name: 'account', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'revokeRootRoles',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'roleBitmap', type: 'uint256' },
      { name: 'account', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

const LOWER = (1n << 128n) - 1n

export function adminBitmap(roleBitmap: bigint): bigint {
  const lower = roleBitmap & LOWER
  const upper = roleBitmap >> 128n
  return (lower | upper) << 128n
}

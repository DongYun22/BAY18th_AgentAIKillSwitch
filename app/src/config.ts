export function readFromBlock(value: string | undefined): number {
  if (value === undefined || !/^[0-9]+$/.test(value)) {
    throw new Error('Missing VITE_FROM_BLOCK')
  }
  return Number(value)
}

export type Version = 'v1' | 'v2'

// v1: a violating execute reverts and the watcher revokes afterwards.
// v2: AgentWallet freezes the token inside the violating transaction (PolicyViolation).
export const deployments = {
  v1: {
    permissionToken: '0xA09511600787d4BF40A49CE3501af2C23d737584',
    agentWallet: '0x0B26b3d6500E8Cf03189042b3341d5be7774d29F',
  },
  v2: {
    permissionToken: '0x2E388Cd03AF310b1E841716B9b5af3662ceF8b83',
    agentWallet: '0xa76f72f6158fD743772449873AFaBDd79c26C352',
  },
} as const

// `?v=2` reads the v2 contracts. Anything else is v1, which is what the mock wallet serves.
export function readVersion(search: string | undefined): Version {
  return new URLSearchParams(search ?? '').get('v') === '2' ? 'v2' : 'v1'
}

const version = readVersion(globalThis.location?.search)

export const config = {
  chainId: 11155111,
  version,
  permissionToken: deployments[version].permissionToken,
  agentWallet: deployments[version].agentWallet,
  permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
  fromBlock: readFromBlock(import.meta.env.VITE_FROM_BLOCK),
  logChunk: 50_000,
} as const

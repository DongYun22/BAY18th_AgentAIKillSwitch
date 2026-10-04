import { getAddress, type Address, type Hex } from 'viem'

export type { Address, Hex }

export type PermissionStatus = 'ACTIVE' | 'FROZEN' | 'REVOKED' | 'EXPIRED'

export type PermissionRow = {
  tokenId: bigint
  holder: Address
  parentId: bigint
  spendingLimit: bigint
  allowlist: Address[]
  expiry: bigint
  status: PermissionStatus
}

export type AgentGroup = {
  agent: Address
  permissions: PermissionRow[]
}

export type IndexedPermissions = {
  roots: PermissionRow[]
  groups: AgentGroup[]
}

export type Erc20Allowance = {
  owner: Address
  token: Address
  spender: Address
  amount: bigint
}

export type Erc721Operator = {
  owner: Address
  token: Address
  operator: Address
  approved: true
}

export type Permit2Allowance = {
  owner: Address
  token: Address
  spender: Address
  amount: bigint
  expiration: bigint
}

export type Delegation7702 = {
  agent: Address
  implementation: Address
}

export type AgentView = {
  agent: Address
  permissions: PermissionRow[]
  erc20: Erc20Allowance[]
  erc721: Erc721Operator[]
  permit2: Permit2Allowance[]
  delegation: Address | null
}

export type ScreenModel = {
  account: AgentView
  agents: AgentView[]
}

export type ChainLog = {
  address: Address
  blockNumber: bigint
  logIndex: number
  args: Record<string, unknown>
}

export type ReadClient = {
  getBlockNumber(): Promise<bigint>
  getBlock(args: { blockTag: 'latest' }): Promise<{ timestamp: bigint }>
  getLogs(args: {
    address?: Address
    fromBlock: bigint
    toBlock: bigint
    event: unknown
    args?: Record<string, unknown>
  }): Promise<ChainLog[]>
  readContract(args: {
    address: Address
    abi: unknown
    functionName: string
    args?: readonly unknown[]
  }): Promise<unknown>
  getCode(args: { address: Address }): Promise<Hex>
}

export type WriteCall = {
  address: Address
  functionName: string
  args: readonly unknown[]
}

export type Sender = {
  chainId: number
  account: Address
  writeContract(args: {
    address: Address
    abi: unknown
    functionName: string
    args: readonly unknown[]
  }): Promise<Hex>
  waitForTransactionReceipt(args: { hash: Hex }): Promise<{ status: 'success' | 'reverted' }>
}

export function sameAddress(left: Address, right: Address): boolean {
  return getAddress(left) === getAddress(right)
}

export function compareAddress(left: Address, right: Address): number {
  const a = getAddress(left)
  const b = getAddress(right)
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

export function compareTokenId(left: bigint, right: bigint): number {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

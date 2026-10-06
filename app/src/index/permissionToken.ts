import { getAddress, type Address } from 'viem'
import { permissionTokenAbi } from '../abi/permissionToken'
import { config } from '../config'
import type { PermissionRow, PermissionStatus, ReadClient } from '../types'
import { scanLogs } from './scan'

type Policy = {
  spendingLimit: bigint
  allowlist: Address[]
  expiry: bigint
}

function asPolicy(value: unknown): Policy {
  if (Array.isArray(value)) {
    const allowlist = value[1] as readonly Address[]
    return {
      spendingLimit: value[0] as bigint,
      allowlist: allowlist.map((item) => getAddress(item)),
      expiry: value[2] as bigint,
    }
  }
  const row = value as { spendingLimit: bigint; allowlist: readonly Address[]; expiry: bigint }
  return {
    spendingLimit: row.spendingLimit,
    allowlist: row.allowlist.map((item) => getAddress(item)),
    expiry: row.expiry,
  }
}

async function readPolicy(client: ReadClient, tokenId: bigint): Promise<Policy> {
  const value = await client.readContract({
    address: config.permissionToken,
    abi: permissionTokenAbi,
    functionName: 'getPolicy',
    args: [tokenId],
  })
  return asPolicy(value)
}

export async function indexPermissions(client: ReadClient, cold: Address): Promise<PermissionRow[]> {
  const checksumCold = getAddress(cold)
  const latest = await client.getBlock({ blockTag: 'latest' })
  const logs = await scanLogs(client, permissionTokenAbi[0], undefined, config.permissionToken)
  const coldRoots = new Set<string>()
  for (const log of logs) {
    const parentId = log.args.parentId as bigint
    const to = getAddress(log.args.to as Address)
    if (parentId === 0n && to === checksumCold) coldRoots.add((log.args.tokenId as bigint).toString())
  }
  const rows: PermissionRow[] = []
  for (const log of logs) {
    const tokenId = log.args.tokenId as bigint
    const to = getAddress(log.args.to as Address)
    const parentId = log.args.parentId as bigint
    const keep = await canManage(client, checksumCold, parentId, to, coldRoots)
    if (!keep) continue
    const policy = await readPolicy(client, tokenId)
    const status = await statusOf(client, tokenId, policy.expiry, latest.timestamp)
    rows.push({
      tokenId,
      holder: to,
      parentId,
      spendingLimit: policy.spendingLimit,
      allowlist: policy.allowlist,
      expiry: policy.expiry,
      status,
    })
  }
  return rows
}

async function canManage(
  client: ReadClient,
  cold: Address,
  parentId: bigint,
  to: Address,
  coldRoots: Set<string>,
): Promise<boolean> {
  if (parentId === 0n) return to === cold
  try {
    const owner = await client.readContract({
      address: config.permissionToken,
      abi: permissionTokenAbi,
      functionName: 'ownerOf',
      args: [parentId],
    })
    return getAddress(owner as Address) === cold
  } catch {
    return coldRoots.has(parentId.toString())
  }
}

async function statusOf(
  client: ReadClient,
  tokenId: bigint,
  expiry: bigint,
  timestamp: bigint,
): Promise<PermissionStatus> {
  try {
    await client.readContract({
      address: config.permissionToken,
      abi: permissionTokenAbi,
      functionName: 'ownerOf',
      args: [tokenId],
    })
  } catch {
    return 'REVOKED'
  }
  if (expiry <= timestamp) return 'EXPIRED'
  const valid = await client.readContract({
    address: config.permissionToken,
    abi: permissionTokenAbi,
    functionName: 'isValid',
    args: [tokenId],
  })
  if (valid === false) return 'FROZEN'
  return 'ACTIVE'
}

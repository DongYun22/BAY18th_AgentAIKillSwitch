import { getAddress, type Address } from 'viem'
import type { IndexedPermissions, PermissionRow } from '../types'
import { compareAddress, compareTokenId, sameAddress } from '../types'

export function groupAgents(cold: Address, rows: PermissionRow[]): IndexedPermissions {
  const roots = rows
    .filter((row) => sameAddress(row.holder, cold) && row.parentId === 0n)
    .sort((left, right) => compareTokenId(left.tokenId, right.tokenId))
  const grouped = new Map<Address, PermissionRow[]>()
  for (const row of rows) {
    if (sameAddress(row.holder, cold) && row.parentId === 0n) continue
    const agent = getAddress(row.holder)
    const list = grouped.get(agent) ?? []
    list.push(row)
    grouped.set(agent, list)
  }
  const groups = [...grouped.entries()]
    .sort((left, right) => compareAddress(left[0], right[0]))
    .map(([agent, permissions]) => ({
      agent,
      permissions: permissions.sort((left, right) => compareTokenId(left.tokenId, right.tokenId)),
    }))
  return { roots, groups }
}

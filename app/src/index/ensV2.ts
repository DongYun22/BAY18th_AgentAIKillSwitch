import { getAddress, type Address } from 'viem'
import { adminBitmap, ensAbi, ensRegistry } from '../abi/ensV2'
import type { EnsRole, ReadClient } from '../types'
import { compareAddress } from '../types'
import { laterLog, scanLogs } from './scan'

export async function indexEnsRoles(client: ReadClient, cold: Address, agents: Address[]): Promise<EnsRole[]> {
  const known = new Set([getAddress(cold), ...agents.map((agent) => getAddress(agent))])
  const logs = await scanLogs(client, ensAbi[0], undefined, ensRegistry)
  const latest = new Map<string, (typeof logs)[number]>()
  for (const log of logs) {
    if (getAddress(log.address) !== ensRegistry) continue
    const resource = log.args.resource as bigint
    const agent = getAddress(log.args.account as Address)
    const key = `${resource}:${agent}`
    const previous = latest.get(key)
    latest.set(key, previous === undefined ? log : laterLog(previous, log))
  }
  const rows: EnsRole[] = []
  for (const log of latest.values()) {
    const roleBitmap = log.args.newRoleBitmap as bigint
    if (roleBitmap === 0n) continue
    const resource = log.args.resource as bigint
    const agent = getAddress(log.args.account as Address)
    const mask = adminBitmap(roleBitmap)
    let revocable = false
    if (mask !== 0n) {
      try {
        revocable = resource === 0n
          ? (await client.readContract({
              address: ensRegistry,
              abi: ensAbi,
              functionName: 'hasRootRoles',
              args: [mask, getAddress(cold)],
            })) as boolean
          : (await client.readContract({
              address: ensRegistry,
              abi: ensAbi,
              functionName: 'hasRoles',
              args: [resource, mask, getAddress(cold)],
            })) as boolean
      } catch {
        revocable = false
      }
    }
    if (!known.has(agent) && !revocable) continue
    rows.push({ registry: ensRegistry, resource, agent, roleBitmap, revocable })
  }
  rows.sort((left, right) => {
    if (left.resource < right.resource) return -1
    if (left.resource > right.resource) return 1
    return compareAddress(left.agent, right.agent)
  })
  return rows
}

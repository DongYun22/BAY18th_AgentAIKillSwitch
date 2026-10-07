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
  const pending: Array<{ resource: bigint; agent: Address; roleBitmap: bigint; mask: bigint }> = []
  for (const log of latest.values()) {
    const roleBitmap = log.args.newRoleBitmap as bigint
    if (roleBitmap === 0n) continue
    const resource = log.args.resource as bigint
    const agent = getAddress(log.args.account as Address)
    pending.push({ resource, agent, roleBitmap, mask: adminBitmap(roleBitmap) })
  }
  const coldAccount = getAddress(cold)
  const revocable = new Map<string, boolean>()
  const checks = pending.filter((item) => item.mask !== 0n)
  const width = 64
  for (let start = 0; start < checks.length; start += width) {
    const slice = checks.slice(start, start + width)
    const answers = await Promise.all(slice.map(async (item) => {
      const key = `${item.resource}:${item.agent}`
      try {
        const allowed = item.resource === 0n
          ? (await client.readContract({
              address: ensRegistry,
              abi: ensAbi,
              functionName: 'hasRootRoles',
              args: [item.mask, coldAccount],
            })) as boolean
          : (await client.readContract({
              address: ensRegistry,
              abi: ensAbi,
              functionName: 'hasRoles',
              args: [item.resource, item.mask, coldAccount],
            })) as boolean
        return [key, allowed] as const
      } catch {
        return [key, false] as const
      }
    }))
    for (const [key, allowed] of answers) revocable.set(key, allowed)
  }
  const rows: EnsRole[] = []
  for (const item of pending) {
    const allowed = revocable.get(`${item.resource}:${item.agent}`) ?? false
    if (!known.has(item.agent) && !allowed) continue
    rows.push({
      registry: ensRegistry,
      resource: item.resource,
      agent: item.agent,
      roleBitmap: item.roleBitmap,
      revocable: allowed,
    })
  }
  rows.sort((left, right) => {
    if (left.resource < right.resource) return -1
    if (left.resource > right.resource) return 1
    return compareAddress(left.agent, right.agent)
  })
  return rows
}

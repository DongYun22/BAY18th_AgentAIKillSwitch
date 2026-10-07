import { formatEther, getAddress, type Address } from 'viem'
import { config } from '../config'
import type { PermissionRow, ReadClient } from '../types'
import type { WatchEvent } from '../view/render'
import { laterLog, scanLogs } from './scan'

export const policyViolationEvent = {
  type: 'event',
  name: 'PolicyViolation',
  inputs: [
    { name: 'tokenId', type: 'uint256', indexed: true },
    { name: 'target', type: 'address', indexed: true },
    { name: 'value', type: 'uint256', indexed: false },
  ],
} as const

// v2 only. A violating execute does not revert: AgentWallet freezes the token in that same
// transaction and emits PolicyViolation. Each listed permission gets its latest one.
export async function indexViolations(client: ReadClient, rows: PermissionRow[]): Promise<WatchEvent[]> {
  const logs = await scanLogs(client, policyViolationEvent, undefined, config.agentWallet)
  const events: WatchEvent[] = []
  for (const row of rows) {
    const mine = logs.filter((log) => (log.args.tokenId as bigint) === row.tokenId)
    if (mine.length === 0) continue
    const last = mine.reduce(laterLog)
    const target = getAddress(last.args.target as Address)
    const listed = row.allowlist.some((item) => getAddress(item) === target)
    events.push({
      level: 'EXEC',
      actor: 'Hot Agent',
      detail: `P#${row.tokenId.toString()} → ${target} · ${formatEther(last.args.value as bigint)} ETH`,
      note: listed ? 'That amount is over the spending limit, so the call was blocked.' : 'target not in allowlist',
      result: 'FROZEN',
      seconds: null,
    })
  }
  return events
}

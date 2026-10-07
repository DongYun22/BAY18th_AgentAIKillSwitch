import { getAddress, type Address, type Hex } from 'viem'
import type { Delegation7702, ReadClient } from '../types'

export function readDelegation(code: Hex): Address | null {
  if (typeof code !== 'string' || code === '0x' || !code.startsWith('0xef0100')) return null
  const body = code.slice(8)
  if (body.length !== 40) return null
  return getAddress(`0x${body}`)
}

export async function indexDelegations(client: ReadClient, agents: Address[]): Promise<Delegation7702[]> {
  const rows: Delegation7702[] = []
  for (const agent of agents) {
    const checksum = getAddress(agent)
    const code = await client.getCode({ address: checksum })
    const implementation = readDelegation(code)
    if (implementation === null) continue
    rows.push({ agent: checksum, implementation })
  }
  return rows
}

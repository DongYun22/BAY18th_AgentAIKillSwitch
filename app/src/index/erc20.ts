import { getAddress, type Address } from 'viem'
import { erc20Abi } from '../abi/permit2'
import type { Erc20Allowance, ReadClient } from '../types'
import { compareAddress } from '../types'
import { laterLog, scanLogs } from './scan'

export async function indexErc20Allowances(client: ReadClient, agents: Address[]): Promise<Erc20Allowance[]> {
  const rows: Erc20Allowance[] = []
  for (const agent of agents) {
    const owner = getAddress(agent)
    const logs = await scanLogs(client, erc20Abi[0], { owner })
    const latest = new Map<string, (typeof logs)[number]>()
    for (const log of logs) {
      if (getAddress(log.args.owner as Address) !== owner) continue
      const token = getAddress(log.address)
      const spender = getAddress(log.args.spender as Address)
      const key = `${token}:${spender}`
      const previous = latest.get(key)
      latest.set(key, previous === undefined ? log : laterLog(previous, log))
    }
    for (const log of latest.values()) {
      const token = getAddress(log.address)
      const spender = getAddress(log.args.spender as Address)
      let amount: bigint
      try {
        amount = (await client.readContract({
          address: token,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [owner, spender],
        })) as bigint
      } catch {
        continue
      }
      if (amount === 0n) continue
      rows.push({ owner, token, spender, amount })
    }
  }
  rows.sort((left, right) => {
    const owner = compareAddress(left.owner, right.owner)
    if (owner !== 0) return owner
    const token = compareAddress(left.token, right.token)
    if (token !== 0) return token
    return compareAddress(left.spender, right.spender)
  })
  return rows
}

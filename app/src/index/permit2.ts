import { getAddress, type Address } from 'viem'
import { permit2Abi } from '../abi/permit2'
import { config } from '../config'
import type { Permit2Allowance, ReadClient } from '../types'
import { compareAddress } from '../types'
import { laterLog, scanLogs } from './scan'

type LiveAllowance = {
  amount: bigint
  expiration: bigint
}

function asAllowance(value: unknown): LiveAllowance {
  if (Array.isArray(value)) {
    return { amount: value[0] as bigint, expiration: value[1] as bigint }
  }
  const row = value as { amount: bigint; expiration: bigint }
  return { amount: row.amount, expiration: row.expiration }
}

export async function indexPermit2Allowances(client: ReadClient, agents: Address[]): Promise<Permit2Allowance[]> {
  const timestamp = (await client.getBlock({ blockTag: 'latest' })).timestamp
  const rows: Permit2Allowance[] = []
  for (const agent of agents) {
    const owner = getAddress(agent)
    const permits = await scanLogs(client, permit2Abi[0], { owner }, config.permit2)
    const approvals = await scanLogs(client, permit2Abi[1], { owner }, config.permit2)
    const latest = new Map<string, (typeof permits)[number]>()
    for (const log of [...permits, ...approvals]) {
      if (getAddress(log.args.owner as Address) !== owner) continue
      const token = getAddress(log.args.token as Address)
      const spender = getAddress(log.args.spender as Address)
      const key = `${token}:${spender}`
      const previous = latest.get(key)
      latest.set(key, previous === undefined ? log : laterLog(previous, log))
    }
    for (const key of latest.keys()) {
      const [token, spender] = key.split(':') as [Address, Address]
      let live: LiveAllowance
      try {
        live = asAllowance(
          await client.readContract({
            address: config.permit2,
            abi: permit2Abi,
            functionName: 'allowance',
            args: [owner, getAddress(token), getAddress(spender)],
          }),
        )
      } catch {
        continue
      }
      if (live.amount === 0n || live.expiration <= timestamp) continue
      rows.push({
        owner,
        token: getAddress(token),
        spender: getAddress(spender),
        amount: live.amount,
        expiration: live.expiration,
      })
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

import { getAddress, type Address } from 'viem'
import type { ReadClient, ScreenModel } from '../types'

const metaAbi = [
  {
    type: 'function',
    name: 'name',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }],
  },
  {
    type: 'function',
    name: 'symbol',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }],
  },
  {
    type: 'function',
    name: 'decimals',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint8' }],
  },
] as const

const KNOWN: Record<string, string> = {
  '0x63c0c19a282a1b52b07dd5a65b58948a07dae32b': 'MetaMask',
  '0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad': 'Uniswap',
  '0x3bfa4769fb09eefc5a80d6e87c3b9c650f7ae48e': 'Uniswap',
  '0x000000000022d473030f116ddee9f6b43ac78ba3': 'Permit2',
  '0x0b26b3d6500e8cf03189042b3341d5be7774d29f': 'AgentWallet',
  '0xa76f72f6158fd743772449873afabdd79c26c352': 'AgentWallet',
}

export type Identity = {
  app: string | null
  token: string | null
  decimals: number | null
}

export function identityTargets(model: ScreenModel): Address[] {
  const found = new Set<string>()
  const add = (value: Address | null): void => {
    if (value === null) return
    found.add(getAddress(value).toLowerCase())
  }
  for (const view of [model.account, ...model.agents]) {
    add(view.delegation)
    for (const row of view.permissions) for (const item of row.allowlist) add(item)
    for (const row of view.erc20) {
      add(row.token)
      add(row.spender)
    }
    for (const row of view.erc721) {
      add(row.token)
      add(row.operator)
    }
    for (const row of view.permit2) {
      add(row.token)
      add(row.spender)
    }
  }
  return [...found].map((item) => getAddress(item))
}

export async function readIdentities(client: ReadClient, addresses: readonly Address[]): Promise<Map<string, Identity>> {
  const unique = [...new Set(addresses.map((item) => getAddress(item)))]
  const rows = await Promise.all(unique.map(async (address) => {
    const key = address.toLowerCase()
    const [name, symbol, decimals] = await Promise.all([
      readString(client, address, 'name'),
      readString(client, address, 'symbol'),
      readDecimals(client, address),
    ])
    const known = KNOWN[key] ?? null
    return [key, { app: known ?? name ?? symbol, token: symbol ?? name ?? known, decimals }] as const
  }))
  return new Map(rows)
}

async function readString(client: ReadClient, address: Address, functionName: 'name' | 'symbol'): Promise<string | null> {
  try {
    const value = await client.readContract({ address, abi: metaAbi, functionName })
    if (typeof value !== 'string') return null
    const text = value.trim()
    if (text.length === 0 || text.length > 64) return null
    return text
  } catch {
    return null
  }
}

async function readDecimals(client: ReadClient, address: Address): Promise<number | null> {
  try {
    const value = await client.readContract({ address, abi: metaAbi, functionName: 'decimals' })
    if (typeof value !== 'number' && typeof value !== 'bigint') return null
    const decimals = Number(value)
    if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) return null
    return decimals
  } catch {
    return null
  }
}

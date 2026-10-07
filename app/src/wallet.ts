import {
  createPublicClient,
  createWalletClient,
  custom,
  getAddress,
  type Address,
  type EIP1193Provider,
  type PublicClient,
  type WalletClient,
} from 'viem'
import { sepolia } from 'viem/chains'

declare global {
  interface Window {
    ethereum?: EIP1193Provider
  }
}

export function assertChain(chainId: number): void {
  if (chainId !== 11155111) {
    throw new Error('Wrong chain')
  }
}

export function shortAddress(address: string): string {
  return `0x${address.slice(2, 6)}…${address.slice(-4)}`
}

let override: EIP1193Provider | null = null

// The demo brings its own in-page wallet. It is used instead of an installed extension, so the
// demo neither reads nor overwrites `window.ethereum` (some wallets make that property read-only).
export function useProvider(next: EIP1193Provider): void {
  override = next
}

function provider(): EIP1193Provider {
  if (override) return override
  const ethereum = globalThis.window?.ethereum
  if (!ethereum) throw new Error('Wrong chain')
  return ethereum
}

export async function connect(): Promise<Address> {
  const accounts = (await provider().request({ method: 'eth_requestAccounts' })) as string[]
  return getAddress(accounts[0] ?? '')
}

export function watchAccount(onChange: (address: Address | null) => void): void {
  if (!override && !globalThis.window?.ethereum) return
  provider().on('accountsChanged', (accounts: string[]) => {
    if (accounts.length === 0) {
      onChange(null)
      return
    }
    onChange(getAddress(accounts[0] ?? ''))
  })
}

export async function requestChainId(): Promise<number> {
  const hex = (await provider().request({ method: 'eth_chainId' })) as string
  return Number(hex)
}

export function publicClient(): PublicClient {
  return createPublicClient({
    chain: sepolia,
    transport: custom(provider()),
    batch: { multicall: { batchSize: 8192, wait: 0 } },
  })
}

export function walletClient(): WalletClient {
  return createWalletClient({ chain: sepolia, transport: custom(provider()) })
}

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

function provider(): EIP1193Provider {
  const ethereum = window.ethereum
  if (!ethereum) throw new Error('Wrong chain')
  return ethereum
}

export async function connect(): Promise<Address> {
  const accounts = (await provider().request({ method: 'eth_requestAccounts' })) as string[]
  return getAddress(accounts[0] ?? '')
}

export function watchAccount(onChange: (address: Address | null) => void): void {
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
  return createPublicClient({ chain: sepolia, transport: custom(provider()) })
}

export function walletClient(): WalletClient {
  return createWalletClient({ chain: sepolia, transport: custom(provider()) })
}

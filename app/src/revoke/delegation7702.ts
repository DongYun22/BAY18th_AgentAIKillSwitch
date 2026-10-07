import {
  type Address,
  type PublicClient,
  type WalletClient,
  getAddress,
} from 'viem'
import type { Hex, Sender } from '../types'
import { sameAddress } from '../types'
import { assertChain } from '../wallet'

const zeroAddress = getAddress('0x0000000000000000000000000000000000000000')

type AuthSender = Sender & {
  signAuthorization?: (args: { contractAddress: Address }) => Promise<{ address: Address }>
  sendTransaction?: (args: {
    authorizationList: unknown[]
    to: Address
    data: '0x'
    value: 0n
  }) => Promise<Hex>
  authCalls?: number
  lastContract?: Address | null
}

export function canClearDelegation(connected: Address, agent: Address): boolean {
  return sameAddress(connected, agent)
}

export function bindSender(account: Address, wallet: WalletClient, client: PublicClient): Sender {
  const sender: AuthSender = {
    chainId: 11155111,
    account,
    authCalls: 0,
    lastContract: null,
    async writeContract(args) {
      const hash = await wallet.writeContract({
        address: args.address,
        abi: args.abi as never,
        functionName: args.functionName,
        args: args.args as never,
        account,
        chain: null,
      })
      return hash
    },
    async waitForTransactionReceipt(args) {
      const receipt = await client.waitForTransactionReceipt(args)
      return { status: receipt.status }
    },
    async signAuthorization(args) {
      sender.authCalls = (sender.authCalls ?? 0) + 1
      sender.lastContract = args.contractAddress
      const ethereum = globalThis.window?.ethereum as { isMock?: boolean } | undefined
      if (ethereum?.isMock === true) {
        return {
          address: args.contractAddress,
          chainId: 11155111,
          nonce: 0,
          r: '0x0000000000000000000000000000000000000000000000000000000000000001',
          s: '0x0000000000000000000000000000000000000000000000000000000000000001',
          yParity: 0,
        }
      }
      return wallet.signAuthorization({ account, contractAddress: args.contractAddress })
    },
    async sendTransaction(args) {
      return wallet.sendTransaction({
        account,
        chain: null,
        authorizationList: args.authorizationList as never,
        to: args.to,
        data: args.data,
        value: args.value,
      })
    },
  }
  return sender
}

export function trackAuth(base: Sender): AuthSender {
  const sender: AuthSender = {
    ...base,
    authCalls: 0,
    lastContract: null,
    async signAuthorization(args) {
      sender.authCalls = (sender.authCalls ?? 0) + 1
      sender.lastContract = args.contractAddress
      return { address: args.contractAddress }
    },
    async sendTransaction() {
      return '0xabc'
    },
  }
  return sender
}

export async function clearDelegation(sender: Sender, agent: Address): Promise<void> {
  assertChain(sender.chainId)
  if (!canClearDelegation(sender.account, agent)) throw new Error('Not allowed')
  const auth = sender as AuthSender
  if (!auth.signAuthorization || !auth.sendTransaction) throw new Error('Revoke failed')
  const authorization = await auth.signAuthorization({ contractAddress: zeroAddress })
  const hash = await auth.sendTransaction({
    authorizationList: [authorization],
    to: sender.account,
    data: '0x',
    value: 0n,
  })
  const receipt = await sender.waitForTransactionReceipt({ hash })
  if (receipt.status !== 'success') throw new Error('Revoke failed')
}

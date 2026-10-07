// An in-page wallet for `?demo=1`. It signs in as the scene owner and answers every read from
// the scene. A send is recorded as mined and never leaves the page.

import {
  decodeAbiParameters,
  encodeAbiParameters,
  getAddress,
  numberToHex,
  toFunctionSelector,
  zeroHash,
  type Address,
  type Hex,
} from 'viem'
import { SCENE_OWNER, sceneBlock, sceneCall, sceneCode, sceneHead, sceneLogs, sceneSend, stageOpen } from './scene'

const AGGREGATE3 = toFunctionSelector('function aggregate3((address,bool,bytes)[])')
const callsType = [
  {
    type: 'tuple[]',
    components: [
      { name: 'target', type: 'address' },
      { name: 'allowFailure', type: 'bool' },
      { name: 'callData', type: 'bytes' },
    ],
  },
] as const
const resultsType = [
  {
    type: 'tuple[]',
    components: [
      { name: 'success', type: 'bool' },
      { name: 'returnData', type: 'bytes' },
    ],
  },
] as const

type Tx = { to?: string | null; data?: string; input?: string }
type Sent = { hash: Hex; to: Address | null; data: Hex }

function rpcError(code: number, message: string): Error {
  return Object.assign(new Error(message), { code })
}

function txData(tx: Tx): Hex {
  const data = tx.data ?? tx.input ?? '0x'
  return (data.startsWith('0x') ? data : '0x') as Hex
}

function call(tx: Tx): Hex {
  if (!tx.to) throw rpcError(3, 'execution reverted')
  const data = txData(tx)
  if (data.slice(0, 10).toLowerCase() === AGGREGATE3) {
    const [calls] = decodeAbiParameters(callsType, `0x${data.slice(10)}`)
    const results = calls.map((item) => {
      const answer = sceneCall(item.target, item.callData)
      return answer === null || answer === 'revert'
        ? { success: false, returnData: '0x' as Hex }
        : { success: true, returnData: answer }
    })
    return encodeAbiParameters(resultsType, [results])
  }
  const answer = sceneCall(getAddress(tx.to), data)
  if (answer === null || answer === 'revert') throw rpcError(3, 'execution reverted')
  return answer
}

export type DemoProvider = {
  isMock: true
  isDemo: true
  request(args: { method: string; params?: unknown }): Promise<unknown>
  on(): void
  removeListener(): void
}

export function createDemoProvider(): DemoProvider {
  const sent: Sent[] = []
  stageOpen()

  async function request(args: { method: string; params?: unknown }): Promise<unknown> {
    const params = (Array.isArray(args.params) ? args.params : []) as unknown[]
    switch (args.method) {
      case 'eth_requestAccounts':
      case 'eth_accounts':
        return [SCENE_OWNER]
      case 'eth_chainId':
        return '0xaa36a7'
      case 'wallet_switchEthereumChain':
        return null
      case 'eth_blockNumber':
        return sceneHead()
      case 'eth_getBlockByNumber':
        return sceneBlock()
      case 'eth_getLogs':
        return sceneLogs((params[0] ?? {}) as Parameters<typeof sceneLogs>[0])
      case 'eth_getCode':
        return sceneCode(getAddress(params[0] as string))
      case 'eth_call':
        return call((params[0] ?? {}) as Tx)
      case 'eth_estimateGas':
        return '0x186A0'
      case 'eth_getTransactionCount':
        return '0x0'
      case 'eth_gasPrice':
      case 'eth_maxPriorityFeePerGas':
        return '0x3B9ACA00'
      case 'eth_sendTransaction': {
        const tx = (params[0] ?? {}) as Tx
        const item: Sent = {
          hash: numberToHex(sent.length + 1, { size: 32 }),
          to: tx.to ? getAddress(tx.to) : null,
          data: txData(tx),
        }
        sent.push(item)
        sceneSend(item.to, item.data)
        return item.hash
      }
      case 'eth_getTransactionReceipt': {
        const found = sent.find((item) => item.hash === params[0])
        if (!found) return null
        return {
          transactionHash: found.hash,
          transactionIndex: '0x0',
          blockHash: zeroHash,
          blockNumber: '0x1',
          from: SCENE_OWNER,
          to: found.to,
          cumulativeGasUsed: '0x0',
          gasUsed: '0x0',
          contractAddress: null,
          logs: [],
          logsBloom: `0x${'0'.repeat(512)}`,
          status: '0x1',
          type: '0x2',
        }
      }
      case 'eth_getTransactionByHash': {
        const found = sent.find((item) => item.hash === params[0])
        if (!found) return null
        return {
          hash: found.hash,
          from: SCENE_OWNER,
          to: found.to,
          input: found.data,
          nonce: '0x0',
          value: '0x0',
          gas: '0x186A0',
          blockNumber: '0x1',
          blockHash: zeroHash,
          transactionIndex: '0x0',
        }
      }
      default:
        throw rpcError(-32601, `The demo wallet does not answer ${args.method}`)
    }
  }

  return { isMock: true, isDemo: true, request, on() {}, removeListener() {} }
}

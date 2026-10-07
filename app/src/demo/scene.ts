// The demo scene: one owner, one agent, three child permissions, and the approvals the agent
// opened. It is the same scene `npm run scene` serves from agent-scripts/scenarioBook.js, kept
// in the page so `?demo=1` needs no server, no wallet, and no chain. Nothing here is broadcast.

import {
  decodeAbiParameters,
  encodeAbiParameters,
  encodeEventTopics,
  getAddress,
  keccak256,
  numberToHex,
  parseAbi,
  parseAbiParameters,
  toFunctionSelector,
  toHex,
  zeroAddress,
  zeroHash,
  type Address,
  type Hex,
} from 'viem'
import { ensRegistry } from '../abi/ensV2'
import { config } from '../config'
import type { WatchEvent } from '../view/render'

const WETH = getAddress('0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9')
const UNI_NFT = getAddress('0x1238536071E1c677A632429e3655c799b22cDA52')
const SEAPORT = getAddress('0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC')
const METAMASK = getAddress('0x63c0c19a282a1B52b07dD5a65b58948A07DAE32B')
const UNISWAP = getAddress('0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD')
const OUTSIDE = getAddress('0x00000000000000000000000000000000000000b1')
const LOG_BLOCK = config.fromBlock + 20
const HEAD = config.fromBlock + 30
const EXPIRY = 1893456000n
const ROOT_LIMIT = 3000000000000000n
const CHILD_LIMIT = 1000000000000000n
const WETH_AMOUNT = 1000000000000000000n
const PERMIT_AMOUNT = 250000000000000000n
const ROLE = 1n
const ADMIN = ROLE << 128n
const ENS_RESOURCE = 11n
const ROOT_ID = 4n
const MANUAL_ID = 1n
const AUTO_ID = 2n
const LIVE_ID = 3n
const CHILDREN = [MANUAL_ID, AUTO_ID, LIVE_ID]

function sceneAddress(label: string): Address {
  return getAddress(`0x${keccak256(toHex(label)).slice(-40)}`)
}

export const SCENE_OWNER = sceneAddress('bay-killswitch-scenario-owner')
export const SCENE_AGENT = sceneAddress('bay-killswitch-scenario-agent')

export type SceneLog = {
  address: Address
  topics: Hex[]
  data: Hex
  blockNumber: Hex
  blockHash: Hex
  transactionHash: Hex
  transactionIndex: Hex
  logIndex: Hex
  removed: false
}

const events = parseAbi([
  'event PermissionMinted(uint256 indexed tokenId, address indexed to, uint256 indexed parentId, uint256 spendingLimit, uint64 expiry)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)',
  'event ApprovalForAll(address indexed owner, address indexed operator, bool approved)',
  'event EACRolesChanged(uint256 indexed resource, address indexed account, uint256 oldRoleBitmap, uint256 newRoleBitmap)',
])
const permitEvents = parseAbi([
  'event Approval(address indexed owner, address indexed token, address indexed spender, uint160 amount, uint48 expiration)',
])

let logs: SceneLog[] = []
let revoked = new Set<string>()
let frozen = new Set<string>()
let roleDropped = false
let watch: WatchEvent[] = []
let revision = 0
let playing = false
let logCount = 0

function bump(): void {
  revision += 1
}

function rawLog(address: Address, topics: readonly unknown[], data: Hex): SceneLog {
  logCount += 1
  return {
    address,
    topics: topics as Hex[],
    data,
    blockNumber: numberToHex(LOG_BLOCK),
    blockHash: zeroHash,
    transactionHash: numberToHex(logCount, { size: 32 }),
    transactionIndex: '0x0',
    logIndex: numberToHex(logCount),
    removed: false,
  }
}

function mint(tokenId: bigint, to: Address, parentId: bigint, limit: bigint): SceneLog {
  return rawLog(
    config.permissionToken,
    encodeEventTopics({ abi: events, eventName: 'PermissionMinted', args: { tokenId, to, parentId } }),
    encodeAbiParameters(parseAbiParameters('uint256, uint64'), [limit, EXPIRY]),
  )
}

function roleLog(newRoleBitmap: bigint, oldRoleBitmap: bigint): SceneLog {
  return rawLog(
    ensRegistry,
    encodeEventTopics({ abi: events, eventName: 'EACRolesChanged', args: { resource: ENS_RESOURCE, account: SCENE_AGENT } }),
    encodeAbiParameters(parseAbiParameters('uint256, uint256'), [oldRoleBitmap, newRoleBitmap]),
  )
}

function grants(): SceneLog[] {
  logCount = 0
  return [
    mint(ROOT_ID, SCENE_OWNER, 0n, ROOT_LIMIT),
    mint(MANUAL_ID, SCENE_AGENT, ROOT_ID, CHILD_LIMIT),
    mint(AUTO_ID, SCENE_AGENT, ROOT_ID, CHILD_LIMIT),
    mint(LIVE_ID, SCENE_AGENT, ROOT_ID, CHILD_LIMIT),
    rawLog(
      WETH,
      encodeEventTopics({ abi: events, eventName: 'Approval', args: { owner: SCENE_AGENT, spender: UNISWAP } }),
      encodeAbiParameters(parseAbiParameters('uint256'), [WETH_AMOUNT]),
    ),
    rawLog(
      UNI_NFT,
      encodeEventTopics({ abi: events, eventName: 'ApprovalForAll', args: { owner: SCENE_AGENT, operator: SEAPORT } }),
      encodeAbiParameters(parseAbiParameters('bool'), [true]),
    ),
    rawLog(
      config.permit2,
      encodeEventTopics({ abi: permitEvents, eventName: 'Approval', args: { owner: SCENE_AGENT, token: WETH, spender: UNISWAP } }),
      encodeAbiParameters(parseAbiParameters('uint160, uint48'), [PERMIT_AMOUNT, Number(EXPIRY)]),
    ),
    roleLog(ROLE, 0n),
  ]
}

function blockedEvent(result: 'BLOCKED' | 'FROZEN'): WatchEvent {
  return {
    level: 'EXEC',
    actor: 'Hot Agent',
    detail: `P#${AUTO_ID} → ${OUTSIDE} · 0.0001 ETH`,
    note: 'target not in allowlist',
    result,
    seconds: null,
  }
}

function autoEvent(): WatchEvent {
  return {
    level: 'KILL',
    actor: 'Owner',
    detail: `Permission #${AUTO_ID} revoke`,
    note: '',
    result: 'REVOKED',
    seconds: 2,
  }
}

export function sceneRevision(): number {
  return revision
}

export function sceneEvents(): WatchEvent[] {
  return watch
}

export function scenePlaying(): boolean {
  return playing
}

export function stageOpen(): void {
  logs = grants()
  revoked = new Set()
  frozen = new Set()
  roleDropped = false
  watch = []
  bump()
}

// V1: the call reverts. The permission stays active until the watcher reacts.
export function stageBlocked(): void {
  watch = [blockedEvent('BLOCKED')]
  bump()
}

export function stageAuto(): void {
  revoked.add(AUTO_ID.toString())
  watch = [blockedEvent('BLOCKED'), autoEvent()]
  bump()
}

export function stageManual(): void {
  revoked.add(MANUAL_ID.toString())
  bump()
}

// V2: the wallet blocks the call and freezes the permission in that same transaction.
export function stageFrozen(): void {
  frozen.add(AUTO_ID.toString())
  watch = [blockedEvent('FROZEN')]
  bump()
}

export function stageEscalated(): void {
  revoked.add(AUTO_ID.toString())
  watch = [blockedEvent('FROZEN'), autoEvent()]
  bump()
}

export type Beat = { wait: number; stage: () => void; caption: string }

export const beats: Record<'v1' | 'v2', Beat[]> = {
  v1: [
    { wait: 0, stage: stageOpen, caption: 'All three permissions are active.' },
    {
      wait: 1600,
      stage: stageBlocked,
      caption: 'Hot Agent tried to pay an address outside the allowlist. The call was blocked. Permission #2 is still active.',
    },
    { wait: 2000, stage: stageAuto, caption: 'The watcher revoked #2, 2 seconds after the blocked call.' },
    { wait: 1600, stage: stageManual, caption: 'The owner revoked #1 by hand. No blocked call came before it. #3 is still active.' },
  ],
  v2: [
    { wait: 0, stage: stageOpen, caption: 'All three permissions are active.' },
    {
      wait: 1600,
      stage: stageFrozen,
      caption: 'Hot Agent tried to pay an address outside the allowlist. The wallet blocked the call and froze #2 in the same transaction.',
    },
    {
      wait: 2000,
      stage: stageEscalated,
      caption: 'The watcher escalated the freeze to a revoke 2 seconds later. #1 and #3 are still active.',
    },
  ],
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function playScene(version: 'v1' | 'v2', onBeat: (caption: string) => void, pace = 1): Promise<void> {
  if (playing) return
  playing = true
  try {
    for (const beat of beats[version]) {
      if (beat.wait > 0) await delay(beat.wait * pace)
      beat.stage()
      onBeat(beat.caption)
    }
  } finally {
    playing = false
  }
}

function sameTopic(left: unknown, right: Hex | undefined): boolean {
  return typeof left === 'string' && right !== undefined && left.toLowerCase() === right.toLowerCase()
}

function matches(filter: unknown, value: Hex | undefined): boolean {
  if (filter === null || filter === undefined) return true
  if (Array.isArray(filter)) return filter.some((item) => sameTopic(item, value))
  return sameTopic(filter, value)
}

export function sceneLogs(filter: { address?: unknown; topics?: unknown[]; fromBlock?: unknown; toBlock?: unknown } = {}): SceneLog[] {
  const from = typeof filter.fromBlock === 'string' && filter.fromBlock.startsWith('0x') ? Number(filter.fromBlock) : null
  const to = typeof filter.toBlock === 'string' && filter.toBlock.startsWith('0x') ? Number(filter.toBlock) : null
  if (from !== null && LOG_BLOCK < from) return []
  if (to !== null && LOG_BLOCK > to) return []
  const topics = filter.topics ?? []
  return logs.filter((item) => {
    if (!matches(filter.address, item.address)) return false
    for (let index = 0; index < topics.length; index += 1) {
      if (!matches(topics[index], item.topics[index])) return false
    }
    return true
  })
}

const SEL = {
  ownerOf: toFunctionSelector('function ownerOf(uint256)'),
  getPolicy: toFunctionSelector('function getPolicy(uint256)'),
  isValid: toFunctionSelector('function isValid(uint256)'),
  parentTokenId: toFunctionSelector('function parentTokenId(uint256)'),
  frozen: toFunctionSelector('function frozen(uint256)'),
  revoke: toFunctionSelector('function revoke(uint256)'),
  allowance: toFunctionSelector('function allowance(address,address)'),
  isApprovedForAll: toFunctionSelector('function isApprovedForAll(address,address)'),
  permitAllowance: toFunctionSelector('function allowance(address,address,address)'),
  hasRoles: toFunctionSelector('function hasRoles(uint256,uint256,address)'),
  revokeRoles: toFunctionSelector('function revokeRoles(uint256,uint256,address)'),
  name: toFunctionSelector('function name()'),
  symbol: toFunctionSelector('function symbol()'),
  decimals: toFunctionSelector('function decimals()'),
}

const NAMES: Record<string, { name: string; symbol: string; decimals: number | null }> = {
  [WETH]: { name: 'Wrapped Ether', symbol: 'WETH', decimals: 18 },
  [UNI_NFT]: { name: 'Uniswap V3 Positions NFT-V1', symbol: 'UNI-V3-POS', decimals: null },
}

const policyType = [
  {
    type: 'tuple',
    components: [
      { name: 'spendingLimit', type: 'uint256' },
      { name: 'allowlist', type: 'address[]' },
      { name: 'expiry', type: 'uint64' },
    ],
  },
] as const

function body(data: Hex): Hex {
  return `0x${data.slice(10)}`
}

function bool(value: boolean): Hex {
  return encodeAbiParameters(parseAbiParameters('bool'), [value])
}

function same(left: Address, right: Address): boolean {
  return left.toLowerCase() === right.toLowerCase()
}

function known(id: bigint): boolean {
  return id === ROOT_ID || CHILDREN.includes(id)
}

function permissionCall(selector: string, data: Hex): Hex | 'revert' | null {
  const reads = [SEL.ownerOf, SEL.getPolicy, SEL.isValid, SEL.parentTokenId, SEL.frozen] as string[]
  if (!reads.includes(selector)) return null
  const [id] = decodeAbiParameters(parseAbiParameters('uint256'), body(data))
  if (!known(id)) return 'revert'
  const key = id.toString()
  const gone = revoked.has(key)
  if (selector === SEL.ownerOf) {
    if (gone) return 'revert'
    return encodeAbiParameters(parseAbiParameters('address'), [id === ROOT_ID ? SCENE_OWNER : SCENE_AGENT])
  }
  if (selector === SEL.getPolicy) {
    return encodeAbiParameters(policyType, [
      { spendingLimit: id === ROOT_ID ? ROOT_LIMIT : CHILD_LIMIT, allowlist: [UNISWAP], expiry: EXPIRY },
    ])
  }
  if (selector === SEL.isValid) {
    const parentStopped = id !== ROOT_ID && (revoked.has(ROOT_ID.toString()) || frozen.has(ROOT_ID.toString()))
    return bool(!gone && !frozen.has(key) && !parentStopped)
  }
  if (selector === SEL.parentTokenId) {
    return encodeAbiParameters(parseAbiParameters('uint256'), [id === ROOT_ID ? 0n : ROOT_ID])
  }
  return bool(frozen.has(key))
}

// Answers a read the page makes. 'revert' is a known call that fails; null is a call this scene
// does not know, which the provider also treats as a revert.
export function sceneCall(to: Address, data: Hex): Hex | 'revert' | null {
  if (logs.length === 0 || data.length < 10) return null
  const selector = data.slice(0, 10).toLowerCase()

  if (same(to, config.permissionToken)) return permissionCall(selector, data)

  const meta = NAMES[getAddress(to)]
  if (meta && selector === SEL.name) return encodeAbiParameters(parseAbiParameters('string'), [meta.name])
  if (meta && selector === SEL.symbol) return encodeAbiParameters(parseAbiParameters('string'), [meta.symbol])
  if (meta && selector === SEL.decimals) {
    return meta.decimals === null ? 'revert' : encodeAbiParameters(parseAbiParameters('uint8'), [meta.decimals])
  }

  if (selector === SEL.allowance) {
    const [owner, spender] = decodeAbiParameters(parseAbiParameters('address, address'), body(data))
    const live = same(to, WETH) && same(owner, SCENE_AGENT) && same(spender, UNISWAP)
    return encodeAbiParameters(parseAbiParameters('uint256'), [live ? WETH_AMOUNT : 0n])
  }
  if (selector === SEL.isApprovedForAll) {
    const [owner, operator] = decodeAbiParameters(parseAbiParameters('address, address'), body(data))
    return bool(same(to, UNI_NFT) && same(owner, SCENE_AGENT) && same(operator, SEAPORT))
  }
  if (selector === SEL.permitAllowance && same(to, config.permit2)) {
    const [owner, token, spender] = decodeAbiParameters(parseAbiParameters('address, address, address'), body(data))
    const live = same(owner, SCENE_AGENT) && same(token, WETH) && same(spender, UNISWAP)
    return encodeAbiParameters(parseAbiParameters('uint160, uint48, uint48'), [live ? PERMIT_AMOUNT : 0n, live ? Number(EXPIRY) : 0, 0])
  }
  if (selector === SEL.hasRoles && same(to, ensRegistry)) {
    const [resource, roleBitmap, account] = decodeAbiParameters(parseAbiParameters('uint256, uint256, address'), body(data))
    return bool(resource === ENS_RESOURCE && roleBitmap === ADMIN && same(account, SCENE_OWNER))
  }
  return null
}

export function sceneCode(account: Address): Hex {
  if (same(account, SCENE_AGENT)) return `0xef0100${METAMASK.slice(2).toLowerCase()}`
  return '0x'
}

// A click in the page. The owner can revoke a permission (a root takes its children with it)
// and drop the ENS role it administers. Any other send is accepted and changes nothing.
export function sceneSend(to: Address | null, data: Hex): void {
  if (to === null || data.length < 10) return
  const selector = data.slice(0, 10).toLowerCase()
  if (same(to, config.permissionToken) && selector === SEL.revoke) {
    const [id] = decodeAbiParameters(parseAbiParameters('uint256'), body(data))
    if (!known(id)) return
    revoked.add(id.toString())
    if (id === ROOT_ID) for (const child of CHILDREN) revoked.add(child.toString())
    bump()
    return
  }
  if (same(to, ensRegistry) && selector === SEL.revokeRoles && !roleDropped) {
    roleDropped = true
    logs = [...logs, roleLog(0n, ROLE)]
    bump()
  }
}

export function sceneBlock(): Record<string, unknown> {
  return {
    number: numberToHex(HEAD),
    hash: zeroHash,
    parentHash: zeroHash,
    timestamp: numberToHex(Math.floor(Date.now() / 1000)),
    gasLimit: '0x1c9c380',
    gasUsed: '0x0',
    miner: zeroAddress,
    difficulty: '0x0',
    totalDifficulty: '0x0',
    extraData: '0x',
    size: '0x0',
    logsBloom: `0x${'0'.repeat(512)}`,
    transactionsRoot: zeroHash,
    stateRoot: zeroHash,
    receiptsRoot: zeroHash,
    sha3Uncles: zeroHash,
    nonce: '0x0000000000000000',
    baseFeePerGas: '0x1',
    transactions: [],
    uncles: [],
  }
}

export function sceneHead(): Hex {
  return numberToHex(HEAD)
}

import type { Address } from 'viem'
import { groupAgents } from './index/agents'
import { identityTargets, readIdentities } from './index/labels'
import { indexEnsRoles } from './index/ensV2'
import { indexDelegations } from './index/delegation7702'
import { indexErc20Allowances } from './index/erc20'
import { indexErc721Operators } from './index/erc721'
import { indexPermissions } from './index/permissionToken'
import { indexPermit2Allowances } from './index/permit2'
import { bindSender } from './revoke/delegation7702'
import type { ReadClient } from './types'
import { beginLoad, renderAgents, renderReading, renderStatus, setIdentities, setScreenActions, setWatchEvents, toScreen, type WatchEvent } from './view/render'
import {
  assertChain,
  connect,
  publicClient,
  requestChainId,
  shortAddress,
  walletClient,
  watchAccount,
} from './wallet'

type Session = { address: Address; chainId: number } | null

function slot(id: string): HTMLElement {
  const found = document.querySelector(id)
  if (!(found instanceof HTMLElement)) throw new Error('Index failed')
  return found
}

const walletSlot = slot('#wallet')
const screenSlot = slot('#screen')
const statusSlot = slot('#status')
const errSlot = slot('#err')
const updatedSlot = slot('#updated')
const liveDot = slot('#live')
const panes = slot('#panes')
const sideToggle = slot('#side-toggle')

const narrowPane = window.matchMedia('(max-width: 1000px)')

function paintRail(): void {
  const shut = panes.classList.contains('side-shut')
  const narrow = narrowPane.matches
  sideToggle.classList.toggle('rail-down', narrow)
  sideToggle.classList.toggle('rail-side', !narrow)
  sideToggle.textContent = narrow ? (shut ? '⌃' : '⌄') : (shut ? '‹' : '›')
  sideToggle.setAttribute('aria-expanded', shut ? 'false' : 'true')
}

sideToggle.addEventListener('click', () => {
  panes.classList.toggle('side-shut')
  paintRail()
})
narrowPane.addEventListener('change', paintRail)
paintRail()

let session: Session = null
let shownRevision = -1
let polling = false
let loading = false

function paint(): void {
  walletSlot.replaceChildren()
  errSlot.replaceChildren()
  if (!session) {
    walletSlot.append(control('Connect', () => { void onConnect() }))
    screenSlot.replaceChildren()
    statusSlot.replaceChildren()
    updatedSlot.textContent = 'waiting'
    liveDot.classList.remove('live')
    setScreenActions(null)
    return
  }
  if (session.chainId !== 11155111) {
    walletSlot.append(control('Switch to Sepolia', () => { void onConnect() }))
    return
  }
  const address = document.createElement('p')
  address.textContent = shortAddress(session.address)
  walletSlot.append(address, control('Disconnect', () => { disconnect() }))
  updatedSlot.textContent = 'reading…'
  liveDot.classList.add('live')
  void load(session.address)
}

function control(label: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement('button')
  button.textContent = label
  button.addEventListener('click', onClick)
  return button
}

async function onConnect(): Promise<void> {
  try {
    const address = await connect()
    const chainId = await requestChainId()
    session = { address, chainId }
    paint()
  } catch {
    paint()
  }
}

function disconnect(): void {
  session = null
  paint()
}

async function load(cold: Address, quiet = false): Promise<void> {
  if (loading) return
  loading = true
  const atStart = await readRevision()
  const client = publicClient()
  const done: string[] = []
  const mark = (current: string | null): void => {
    renderReading(screenSlot, done, current)
    updatedSlot.textContent = 'reading…'
  }
  try {
    assertChain(11155111)
    beginLoad()
    if (!quiet) mark('Permission')
    const rows = await indexPermissions(client as unknown as ReadClient, cold)
    done.push('Permission')
    const indexed = groupAgents(cold, rows)
    const addresses = [cold, ...indexed.groups.map((group) => group.agent)]
    if (!quiet) mark('Allowances')
    const erc20 = await indexErc20Allowances(client as unknown as ReadClient, addresses)
    done.push('Allowances')
    if (!quiet) mark('Operators')
    const erc721 = await indexErc721Operators(client as unknown as ReadClient, addresses)
    done.push('Operators')
    if (!quiet) mark('Permit2')
    const permit2 = await indexPermit2Allowances(client as unknown as ReadClient, addresses)
    done.push('Permit2')
    if (!quiet) mark('Delegation')
    const delegations = await indexDelegations(client as unknown as ReadClient, addresses)
    done.push('Delegation')
    if (!quiet) mark('Roles')
    const ens = await indexEnsRoles(client as unknown as ReadClient, cold, addresses)
    done.push('Roles')
    const model = toScreen(cold, indexed, erc20, erc721, permit2, delegations, ens)
    const identities = await readIdentities(client as unknown as ReadClient, identityTargets(model))
    setIdentities(identities)
    setWatchEvents(await readWatchEvents())
    const sender = bindSender(cold, walletClient(), client)
    const draw = (): void => {
      setScreenActions({ sender, refresh: draw })
      renderAgents(screenSlot, model)
      renderStatus(statusSlot, model)
      updatedSlot.textContent = 'updated'
      liveDot.classList.remove('live')
    }
    draw()
    const atEnd = await readRevision()
    shownRevision = atStart
    if (atEnd !== atStart && session?.address === cold) {
      loading = false
      await load(cold, true)
      return
    }
    void poll(cold)
  } catch (error) {
    console.error(error)
    liveDot.classList.remove('live')
    const failed = document.createElement('p')
    failed.className = 'error'
    failed.textContent = 'Index failed'
    errSlot.replaceChildren(failed)
  } finally {
    loading = false
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function readRevision(): Promise<number> {
  const ethereum = window.ethereum
  if (!ethereum || !('isMock' in ethereum) || ethereum.isMock !== true) return -1
  try {
    const response = await fetch('http://127.0.0.1:8787/demo/rev')
    if (!response.ok) return -1
    const body = await response.json() as { revision?: number }
    return typeof body.revision === 'number' ? body.revision : -1
  } catch {
    return -1
  }
}

async function poll(cold: Address): Promise<void> {
  if (polling) return
  if (!window.ethereum || !('isMock' in window.ethereum) || window.ethereum.isMock !== true) return
  polling = true
  try {
    while (session?.address === cold) {
      await sleep(400)
      if (session?.address !== cold) break
      const revision = await readRevision()
      if (revision < 0 || revision === shownRevision) continue
      await load(cold, true)
    }
  } finally {
    polling = false
  }
}

async function readWatchEvents(): Promise<WatchEvent[]> {
  const ethereum = window.ethereum
  if (!ethereum || !('isMock' in ethereum) || ethereum.isMock !== true) return []
  try {
    const response = await fetch('http://127.0.0.1:8787/demo/log')
    if (!response.ok) return []
    const body = await response.json() as WatchEvent[]
    return Array.isArray(body) ? body : []
  } catch {
    return []
  }
}

watchAccount((address) => {
  if (address === null) {
    disconnect()
    return
  }
  void requestChainId().then((chainId) => {
    session = { address, chainId }
    paint()
  })
})

paint()

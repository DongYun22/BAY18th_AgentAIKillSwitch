import type { Address } from 'viem'
import { groupAgents } from './index/agents'
import { indexEnsRoles } from './index/ensV2'
import { indexDelegations } from './index/delegation7702'
import { indexErc20Allowances } from './index/erc20'
import { indexErc721Operators } from './index/erc721'
import { indexPermissions } from './index/permissionToken'
import { indexPermit2Allowances } from './index/permit2'
import { bindSender } from './revoke/delegation7702'
import type { ReadClient } from './types'
import { renderAgents, setScreenActions, toScreen } from './view/render'
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

const found = document.querySelector('#app')
if (!found) throw new Error('Index failed')
const app: HTMLElement = found as HTMLElement

const walletSlot = document.createElement('div')
const screenSlot = document.createElement('div')
app.append(walletSlot, screenSlot)

let session: Session = null

function paint(): void {
  walletSlot.replaceChildren()
  const title = document.createElement('h1')
  title.textContent = 'Kill-switch'
  walletSlot.append(title)
  if (!session) {
    walletSlot.append(control('Connect', () => { void onConnect() }))
    screenSlot.replaceChildren()
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

async function load(cold: Address): Promise<void> {
  const client = publicClient()
  try {
    assertChain(11155111)
    const rows = await indexPermissions(client as unknown as ReadClient, cold)
    const indexed = groupAgents(cold, rows)
    const addresses = [cold, ...indexed.groups.map((group) => group.agent)]
    const erc20 = await indexErc20Allowances(client as unknown as ReadClient, addresses)
    const erc721 = await indexErc721Operators(client as unknown as ReadClient, addresses)
    const permit2 = await indexPermit2Allowances(client as unknown as ReadClient, addresses)
    const delegations = await indexDelegations(client as unknown as ReadClient, addresses)
    const ens = await indexEnsRoles(client as unknown as ReadClient, cold, addresses)
    setScreenActions({ sender: bindSender(cold, walletClient(), client) })
    renderAgents(screenSlot, toScreen(cold, indexed, erc20, erc721, permit2, delegations, ens))
  } catch (error) {
    console.error(error)
    const failed = document.createElement('p')
    failed.textContent = 'Index failed'
    app.prepend(failed)
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

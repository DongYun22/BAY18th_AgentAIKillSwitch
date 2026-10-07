import { createPublicClient, createWalletClient, custom, parseAbi, type EIP1193Provider } from 'viem'
import { sepolia } from 'viem/chains'
import { describe, expect, it } from 'vitest'
import { ensAbi, ensRegistry } from '../abi/ensV2'
import { permissionTokenAbi } from '../abi/permissionToken'
import { config } from '../config'
import { groupAgents } from '../index/agents'
import { indexDelegations } from '../index/delegation7702'
import { indexEnsRoles } from '../index/ensV2'
import { indexErc20Allowances } from '../index/erc20'
import { indexErc721Operators } from '../index/erc721'
import { identityTargets, readIdentities } from '../index/labels'
import { indexPermissions } from '../index/permissionToken'
import { indexPermit2Allowances } from '../index/permit2'
import type { PermissionStatus, ReadClient } from '../types'
import { toScreen } from '../view/render'
import { createDemoProvider } from './provider'
import {
  SCENE_AGENT,
  SCENE_OWNER,
  beats,
  playScene,
  sceneEvents,
  sceneRevision,
  stageAuto,
  stageBlocked,
  stageEscalated,
  stageFrozen,
  stageManual,
  stageOpen,
} from './scene'

// The same client the page builds in wallet.ts, multicall batching included.
const provider = createDemoProvider() as unknown as EIP1193Provider
const client = createPublicClient({
  chain: sepolia,
  transport: custom(provider),
  batch: { multicall: { batchSize: 8192, wait: 0 } },
})
const reader = client as unknown as ReadClient

async function statuses(): Promise<Record<string, PermissionStatus>> {
  const rows = await indexPermissions(reader, SCENE_OWNER)
  return Object.fromEntries(rows.map((row) => [row.tokenId.toString(), row.status]))
}

describe('demo scene', () => {
  it('signs in as the scene owner on Sepolia', async () => {
    expect(await provider.request({ method: 'eth_requestAccounts' })).toEqual([SCENE_OWNER])
    expect(await provider.request({ method: 'eth_chainId' })).toBe('0xaa36a7')
  })

  it('gives the page one root, three children, and every kind of agent approval', async () => {
    stageOpen()
    const rows = await indexPermissions(reader, SCENE_OWNER)
    const indexed = groupAgents(SCENE_OWNER, rows)
    expect(indexed.roots.map((row) => row.tokenId)).toEqual([4n])
    expect(indexed.groups.length).toBe(1)
    expect(indexed.groups[0].agent).toBe(SCENE_AGENT)
    expect(indexed.groups[0].permissions.length).toBe(3)
    expect(rows.every((row) => row.status === 'ACTIVE')).toBe(true)

    const addresses = [SCENE_OWNER, SCENE_AGENT]
    const erc20 = await indexErc20Allowances(reader, addresses)
    const erc721 = await indexErc721Operators(reader, addresses)
    const permit2 = await indexPermit2Allowances(reader, addresses)
    const delegations = await indexDelegations(reader, addresses)
    const ens = await indexEnsRoles(reader, SCENE_OWNER, addresses)
    expect(erc20.map((row) => row.owner)).toEqual([SCENE_AGENT])
    expect(erc721.map((row) => row.owner)).toEqual([SCENE_AGENT])
    expect(permit2.map((row) => row.owner)).toEqual([SCENE_AGENT])
    expect(delegations.map((row) => row.agent)).toEqual([SCENE_AGENT])
    expect(ens.map((row) => [row.resource, row.revocable])).toEqual([[11n, true]])

    const model = toScreen(SCENE_OWNER, indexed, erc20, erc721, permit2, delegations, ens)
    const identities = await readIdentities(reader, identityTargets(model))
    expect(identities.get(erc20[0].token.toLowerCase())?.token).toBe('WETH')
  })

  it('V1: the blocked call leaves #2 active until the watcher revokes it', async () => {
    stageOpen()
    stageBlocked()
    expect((await statuses())['2']).toBe('ACTIVE')
    expect(sceneEvents()[0].result).toBe('BLOCKED')
    stageAuto()
    expect(await statuses()).toEqual({ '1': 'ACTIVE', '2': 'REVOKED', '3': 'ACTIVE', '4': 'ACTIVE' })
    stageManual()
    expect(await statuses()).toEqual({ '1': 'REVOKED', '2': 'REVOKED', '3': 'ACTIVE', '4': 'ACTIVE' })
  })

  it('V2: the blocked call freezes #2 at once, then the watcher escalates', async () => {
    stageOpen()
    stageFrozen()
    expect(await statuses()).toEqual({ '1': 'ACTIVE', '2': 'FROZEN', '3': 'ACTIVE', '4': 'ACTIVE' })
    expect(sceneEvents()[0].result).toBe('FROZEN')
    stageEscalated()
    expect(await statuses()).toEqual({ '1': 'ACTIVE', '2': 'REVOKED', '3': 'ACTIVE', '4': 'ACTIVE' })
    expect(sceneEvents()[1].seconds).toBe(2)
  })

  it('plays every beat in order and bumps the revision each time', async () => {
    for (const version of ['v1', 'v2'] as const) {
      const before = sceneRevision()
      const seen: string[] = []
      await playScene(version, (caption) => { seen.push(caption) }, 0)
      expect(seen).toEqual(beats[version].map((beat) => beat.caption))
      expect(sceneRevision()).toBe(before + beats[version].length)
    }
  })

  it('a Revoke click changes the scene and is mined without leaving the page', async () => {
    stageOpen()
    const wallet = createWalletClient({ chain: sepolia, transport: custom(provider) })
    const hash = await wallet.writeContract({
      address: config.permissionToken,
      abi: permissionTokenAbi,
      functionName: 'revoke',
      args: [3n],
      account: SCENE_OWNER,
      chain: null,
    })
    const receipt = await client.waitForTransactionReceipt({ hash })
    expect(receipt.status).toBe('success')
    expect((await statuses())['3']).toBe('REVOKED')

    const roleHash = await wallet.writeContract({
      address: ensRegistry,
      abi: ensAbi,
      functionName: 'revokeRoles',
      args: [11n, 1n, SCENE_AGENT],
      account: SCENE_OWNER,
      chain: null,
    })
    await client.waitForTransactionReceipt({ hash: roleHash })
    expect(await indexEnsRoles(reader, SCENE_OWNER, [SCENE_OWNER, SCENE_AGENT])).toEqual([])
  })

  it('revoking the root takes every child with it', async () => {
    stageOpen()
    const wallet = createWalletClient({ chain: sepolia, transport: custom(provider) })
    const hash = await wallet.writeContract({
      address: config.permissionToken,
      abi: permissionTokenAbi,
      functionName: 'revoke',
      args: [4n],
      account: SCENE_OWNER,
      chain: null,
    })
    await client.waitForTransactionReceipt({ hash })
    expect(await statuses()).toEqual({ '1': 'REVOKED', '2': 'REVOKED', '3': 'REVOKED', '4': 'REVOKED' })
  })

  it('a call the scene does not know reverts instead of reaching a network', async () => {
    await expect(client.readContract({
      address: '0x00000000000000000000000000000000000000c1',
      abi: parseAbi(['function totalSupply() view returns (uint256)']),
      functionName: 'totalSupply',
    })).rejects.toThrow()
    await expect(provider.request({ method: 'eth_getBalance' as never })).rejects.toThrow('demo wallet')
  })
})

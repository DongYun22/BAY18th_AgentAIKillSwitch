import { describe, expect, it } from 'vitest'
import { assertChain, shortAddress, watchAccount } from './wallet'

describe('K-T-2', () => {
  it('assertChain(11155111) returns', () => {
    expect(() => assertChain(11155111)).not.toThrow()
  })

  it('assertChain(1) throws Wrong chain', () => {
    expect(() => assertChain(1)).toThrow('Wrong chain')
  })

  it("shortAddress is 0xB6AF…2836", () => {
    expect(shortAddress('0xB6AF02FeEA21e2960A7C14FAf97bAdbE2E982836')).toBe('0xB6AF…2836')
  })

  it('does not throw when no wallet is injected', () => {
    const previous = globalThis.window
    Object.assign(globalThis, { window: {} })
    expect(() => watchAccount(() => {})).not.toThrow()
    Object.assign(globalThis, { window: previous })
  })
})

describe('demo wallet', () => {
  it('is used instead of an injected wallet once set', async () => {
    const { connect, requestChainId, useProvider } = await import('./wallet')
    const calls: string[] = []
    useProvider({
      async request(args: { method: string }) {
        calls.push(args.method)
        return args.method === 'eth_chainId' ? '0xaa36a7' : ['0xB6AF02FeEA21e2960A7C14FAf97bAdbE2E982836']
      },
      on() {},
      removeListener() {},
    } as never)
    expect(await connect()).toBe('0xB6AF02FeEA21e2960A7C14FAf97bAdbE2E982836')
    expect(await requestChainId()).toBe(11155111)
    expect(calls).toEqual(['eth_requestAccounts', 'eth_chainId'])
  })
})

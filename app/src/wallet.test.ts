import { describe, expect, it } from 'vitest'
import { assertChain, shortAddress } from './wallet'

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
})

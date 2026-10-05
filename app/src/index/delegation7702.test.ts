import { getAddress } from 'viem'
import { describe, expect, it } from 'vitest'
import { readDelegation } from './delegation7702'

describe('K-T-8', () => {
  it('returns null for empty code', () => {
    expect(readDelegation('0x')).toBeNull()
    expect(readDelegation(undefined as unknown as '0x')).toBeNull()
  })

  it('returns the zero address for twenty zero bytes', () => {
    expect(readDelegation(`0xef0100${'0'.repeat(40)}`)).toBe(getAddress('0x0000000000000000000000000000000000000000'))
  })

  it('returns the implementation address', () => {
    expect(readDelegation('0xef0100b6af02feea21e2960a7c14faf97badbe2e982836')).toBe(
      '0xB6AF02FeEA21e2960A7C14FAf97bAdbE2E982836',
    )
  })

  it('returns null for a 22 byte suffix', () => {
    expect(readDelegation(`0xef0100${'ab'.repeat(22)}`)).toBeNull()
  })
})

import { describe, expect, it } from 'vitest'
import { readFromBlock } from './config'

describe('K-T-1', () => {
  it("readFromBlock('100') is 100", () => {
    expect(readFromBlock('100')).toBe(100)
  })

  it('undefined throws Missing VITE_FROM_BLOCK', () => {
    expect(() => readFromBlock(undefined)).toThrow('Missing VITE_FROM_BLOCK')
  })

  it("'0x10' throws Missing VITE_FROM_BLOCK", () => {
    expect(() => readFromBlock('0x10')).toThrow('Missing VITE_FROM_BLOCK')
  })
})

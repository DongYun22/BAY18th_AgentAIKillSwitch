import { describe, expect, it } from 'vitest'
import { readFromBlock, readVersion } from './config'

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

describe('contract version', () => {
  it("'?v=2' is v2", () => {
    expect(readVersion('?v=2')).toBe('v2')
  })

  it('no query, or any other value, is v1', () => {
    expect(readVersion(undefined)).toBe('v1')
    expect(readVersion('?mock=1')).toBe('v1')
    expect(readVersion('?v=3')).toBe('v1')
  })
})

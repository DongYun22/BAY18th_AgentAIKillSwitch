import { describe, expect, it } from 'vitest'

const files = import.meta.glob('./**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

const needles = [
  'wallet_revokeExecutionPermission',
  'wallet_getGrantedExecutionPermissions',
  'wallet_requestExecutionPermissions',
  'unsubmittedPermit',
  'offchainDelegation',
]

describe('K-T-13', () => {
  it('rejects forbidden strings outside the delegation file', () => {
    for (const [path, source] of Object.entries(files)) {
      if (path.endsWith('boundary.test.ts')) continue
      for (const needle of needles) {
        expect(source.includes(needle), path).toBe(false)
      }
      if (!path.endsWith('revoke/delegation7702.ts')) {
        expect(source.includes('signAuthorization'), path).toBe(false)
      }
      expect(source.includes('dashboard/index.html'), path).toBe(false)
    }
  })
})

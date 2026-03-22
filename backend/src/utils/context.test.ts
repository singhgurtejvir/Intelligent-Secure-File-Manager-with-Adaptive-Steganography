import { matchesContext, normalizeContext } from './context'

describe('context utils', () => {
  it('normalizes device context', () => {
    const normalized = normalizeContext({
      deviceFingerprint: 'abc123',
      timezone: 'Asia/Calcutta',
      language: 'en-IN',
      userAgent: 'Mozilla/5.0',
    })

    expect(normalized).toEqual({
      deviceFingerprint: 'abc123',
      timezone: 'Asia/Calcutta',
      language: 'en-in',
      userAgentHash: expect.any(String),
    })
  })

  it('matches sufficiently similar context', () => {
    const stored = normalizeContext({
      deviceFingerprint: 'abcdef123456',
      timezone: 'Asia/Calcutta',
      language: 'en-IN',
      userAgent: 'Agent',
    })

    const result = matchesContext(stored, {
      deviceFingerprint: 'abcdef123450',
      timezone: 'Asia/Calcutta',
      language: 'en-GB',
      userAgent: 'Agent',
    })

    expect(result.allowed).toBe(true)
    expect(result.score).toBeGreaterThan(0.75)
    expect(result.signals.timezone).toBe(true)
    expect(result.signals.language).toBe(true)
  })

  it('allows an exact fingerprint match even when a secondary signal drifts', () => {
    const stored = normalizeContext({
      deviceFingerprint: 'stable-device-fingerprint',
      timezone: 'Asia/Calcutta',
      language: 'en-IN',
      userAgent: 'OldAgent',
    })

    const result = matchesContext(stored, {
      deviceFingerprint: 'stable-device-fingerprint',
      timezone: 'UTC',
      language: 'en-IN',
      userAgent: 'NewAgent',
    })

    expect(result.allowed).toBe(true)
    expect(result.score).toBeLessThan(0.75)
    expect(result.signals.deviceFingerprint).toBe(1)
    expect(result.signals.timezone).toBe(false)
    expect(result.signals.userAgent).toBe(false)
  })
})

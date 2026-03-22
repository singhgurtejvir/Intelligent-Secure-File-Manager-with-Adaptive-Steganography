import crypto from 'crypto'

export interface DeviceContext {
  deviceFingerprint?: string
  timezone?: string
  language?: string
  userAgent?: string
}

export interface ContextMatchResult {
  allowed: boolean
  score: number
  signals: {
    deviceFingerprint: number | null
    timezone: boolean | null
    language: boolean | null
    userAgent: boolean | null
  }
}

interface NormalizedContext {
  deviceFingerprint?: string
  timezone?: string
  language?: string
  userAgentHash?: string
}

function hashValue(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function similarity(left: string, right: string): number {
  const maxLength = Math.max(left.length, right.length)
  if (maxLength === 0) {
    return 1
  }

  let matches = 0
  const minLength = Math.min(left.length, right.length)

  for (let index = 0; index < minLength; index += 1) {
    if (left[index] === right[index]) {
      matches += 1
    }
  }

  return matches / maxLength
}

export function normalizeContext(input?: DeviceContext): NormalizedContext | undefined {
  if (!input) {
    return undefined
  }

  const normalized: NormalizedContext = {}

  if (typeof input.deviceFingerprint === 'string' && input.deviceFingerprint.trim()) {
    normalized.deviceFingerprint = input.deviceFingerprint.trim()
  }

  if (typeof input.timezone === 'string' && input.timezone.trim()) {
    normalized.timezone = input.timezone.trim()
  }

  if (typeof input.language === 'string' && input.language.trim()) {
    normalized.language = input.language.trim().toLowerCase()
  }

  if (typeof input.userAgent === 'string' && input.userAgent.trim()) {
    normalized.userAgentHash = hashValue(input.userAgent.trim())
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined
}

export function matchesContext(
  stored?: NormalizedContext,
  provided?: DeviceContext,
): ContextMatchResult {
  if (!stored || Object.keys(stored).length === 0) {
    return {
      allowed: true,
      score: 1,
      signals: {
        deviceFingerprint: null,
        timezone: null,
        language: null,
        userAgent: null,
      },
    }
  }

  const normalizedProvided = normalizeContext(provided)
  if (!normalizedProvided) {
    return {
      allowed: false,
      score: 0,
      signals: {
        deviceFingerprint: stored.deviceFingerprint ? 0 : null,
        timezone: stored.timezone ? false : null,
        language: stored.language ? false : null,
        userAgent: stored.userAgentHash ? false : null,
      },
    }
  }

  let score = 0
  let weight = 0
  let fingerprintSignal: number | null = null
  let timezoneSignal: boolean | null = null
  let languageSignal: boolean | null = null
  let userAgentSignal: boolean | null = null

  if (stored.deviceFingerprint) {
    weight += 0.6
    const fingerprintScore = normalizedProvided.deviceFingerprint
      ? similarity(stored.deviceFingerprint, normalizedProvided.deviceFingerprint)
      : 0
    fingerprintSignal = fingerprintScore
    score += fingerprintScore * 0.6
  }

  if (stored.timezone) {
    weight += 0.2
    timezoneSignal = stored.timezone === normalizedProvided.timezone
    score += (timezoneSignal ? 1 : 0) * 0.2
  }

  if (stored.language) {
    weight += 0.1
    const storedLanguage = stored.language.split('-')[0]
    const providedLanguage = normalizedProvided.language?.split('-')[0]
    languageSignal = storedLanguage === providedLanguage
    score += (languageSignal ? 1 : 0) * 0.1
  }

  if (stored.userAgentHash) {
    weight += 0.1
    userAgentSignal = stored.userAgentHash === normalizedProvided.userAgentHash
    score += (userAgentSignal ? 1 : 0) * 0.1
  }

  const normalizedScore = weight > 0 ? score / weight : 1
  const strongFingerprintMatch = fingerprintSignal !== null && fingerprintSignal >= 0.98
  return {
    allowed: normalizedScore >= 0.75 || strongFingerprintMatch,
    score: normalizedScore,
    signals: {
      deviceFingerprint: fingerprintSignal,
      timezone: timezoneSignal,
      language: languageSignal,
      userAgent: userAgentSignal,
    },
  }
}

export function buildDecoyContent(fileName: string): string {
  return [
    'This file is unavailable from the current device context.',
    `Requested asset: ${fileName}`,
    'Tip: verify the expected device, timezone, and language before trying again.',
  ].join('\n')
}

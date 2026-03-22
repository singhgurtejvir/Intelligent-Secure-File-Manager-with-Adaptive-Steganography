import FingerprintJS from '@fingerprintjs/fingerprintjs'

type FingerprintAgent = Awaited<ReturnType<typeof FingerprintJS.load>>

let fpPromise: Promise<FingerprintAgent> | null = null

export async function initFingerprint() {
  if (!fpPromise) {
    fpPromise = FingerprintJS.load()
  }
  return fpPromise
}

export async function getDeviceFingerprint(): Promise<string> {
  const fp = await initFingerprint()
  const result = await fp.get()
  return result.visitorId
}

export async function getDeviceContext() {
  return {
    deviceFingerprint: await getDeviceFingerprint(),
    userAgent: navigator.userAgent,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: navigator.language,
  }
}

export function fuzzyMatchFingerprint(
  current: string,
  stored: string,
  tolerance: number = 0.9,
): boolean {
  // Simple hamming distance-based comparison
  if (current === stored) return true
  
  const distance = Math.min(current.length, stored.length)
  let matches = 0
  
  for (let i = 0; i < distance; i++) {
    if (current[i] === stored[i]) {
      matches++
    }
  }
  
  return matches / distance >= tolerance
}

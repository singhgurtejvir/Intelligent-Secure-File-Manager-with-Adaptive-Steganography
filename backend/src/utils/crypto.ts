import crypto from 'crypto'

const PBKDF2_ITERATIONS = 100000
const KEY_LENGTH = 32
const DIGEST = 'sha256'
const SALT_LENGTH = 16
const IV_LENGTH = 12

export function encryptBuffer(payload: Buffer, password: string): Buffer {
  const salt = crypto.randomBytes(SALT_LENGTH)
  const iv = crypto.randomBytes(IV_LENGTH)
  const key = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, DIGEST)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)

  const encrypted = Buffer.concat([cipher.update(payload), cipher.final()])
  const authTag = cipher.getAuthTag()

  return Buffer.concat([salt, iv, authTag, encrypted])
}

export function decryptBuffer(payload: Buffer, password: string): Buffer {
  if (payload.length < SALT_LENGTH + IV_LENGTH + 16) {
    throw new Error('Encrypted payload is corrupted')
  }

  const salt = payload.subarray(0, SALT_LENGTH)
  const iv = payload.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH)
  const authTag = payload.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + 16)
  const encrypted = payload.subarray(SALT_LENGTH + IV_LENGTH + 16)
  const key = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, DIGEST)
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)

  decipher.setAuthTag(authTag)

  try {
    return Buffer.concat([decipher.update(encrypted), decipher.final()])
  } catch {
    throw new Error('Invalid password or corrupted payload')
  }
}

import { decryptBuffer, encryptBuffer } from './crypto'

describe('crypto utils', () => {
  it('encrypts and decrypts buffers', () => {
    const payload = Buffer.from('secret payload')
    const encrypted = encryptBuffer(payload, 'super-secret-password')
    const decrypted = decryptBuffer(encrypted, 'super-secret-password')

    expect(decrypted.toString()).toBe('secret payload')
    expect(encrypted.equals(payload)).toBe(false)
  })

  it('throws for the wrong password', () => {
    const payload = Buffer.from('secret payload')
    const encrypted = encryptBuffer(payload, 'super-secret-password')

    expect(() => decryptBuffer(encrypted, 'wrong-password')).toThrow(
      'Invalid password or corrupted payload',
    )
  })
})

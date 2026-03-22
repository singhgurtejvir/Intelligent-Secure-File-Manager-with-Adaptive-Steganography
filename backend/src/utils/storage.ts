import fs from 'fs'
import path from 'path'

const uploadDir = path.resolve('uploads')
const encryptedDir = path.join(uploadDir, 'encrypted')

function ensureDirectory(directory: string): void {
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true })
  }
}

ensureDirectory(uploadDir)
ensureDirectory(encryptedDir)

export function getEncryptedPayloadPath(filename: string): string {
  return path.join(encryptedDir, filename)
}

export function writeEncryptedPayload(filename: string, content: Buffer): string {
  const fullPath = getEncryptedPayloadPath(filename)
  fs.writeFileSync(fullPath, content)
  return fullPath
}

export function readEncryptedPayload(filename: string): Buffer {
  return fs.readFileSync(getEncryptedPayloadPath(filename))
}

export function deleteStoredFile(filepath: string): void {
  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath)
  }
}

import fs from 'fs'
import path from 'path'

const uploadDir = path.resolve('uploads')
const shareDir = path.join(uploadDir, 'shared')

function ensureDirectory(directory: string): void {
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true })
  }
}

ensureDirectory(uploadDir)
ensureDirectory(shareDir)

export function writeSharedArtifact(filename: string, content: Buffer): string {
  const fullPath = path.join(shareDir, filename)
  fs.writeFileSync(fullPath, content)
  return fullPath
}

export function readSharedArtifact(filepath: string): Buffer {
  return fs.readFileSync(filepath)
}

export function getSharedArtifactPath(filepath: string): string {
  return path.isAbsolute(filepath) ? filepath : path.join(shareDir, filepath)
}

export function deleteSharedArtifact(filepath: string): void {
  const fullPath = getSharedArtifactPath(filepath)
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath)
  }
}

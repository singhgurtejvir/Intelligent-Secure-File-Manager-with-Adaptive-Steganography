import fs from 'fs'
import path from 'path'

const logDir = path.resolve('logs')
const auditLogPath = path.join(logDir, 'activity.log')

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true })
}

export function writeAuditLog(entry: Record<string, unknown>): void {
  const payload = {
    timestamp: new Date().toISOString(),
    ...entry,
  }

  fs.appendFileSync(auditLogPath, `${JSON.stringify(payload)}\n`)
}

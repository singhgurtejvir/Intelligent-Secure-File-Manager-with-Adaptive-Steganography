import { FormEvent, useEffect, useMemo, useState } from 'react'
import { ApiError, checkFileContext, decryptFile, deleteFile, listFiles, type FileContextCheck, type VaultFile } from '@/utils/api'
import { getDeviceContext } from '@/utils/fingerprint'
import { useVaultStore } from '@/store/vaultStore'
import { useFileStore } from '@/store/fileStore'
import Breadcrumbs from '@/components/layout/Breadcrumbs'
import StatusBar from '@/components/layout/StatusBar'
import Toolbar from '@/components/layout/Toolbar'
import FileWorkspace from '@/components/filemanager/FileWorkspace'
import DecryptModal from '@/components/DecryptModal'

function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  window.URL.revokeObjectURL(url)
}

export default function Gallery() {
  const [files, setFiles] = useState<VaultFile[]>([])
  const [loading, setLoading] = useState(true)
  const [decryptFileItem, setDecryptFileItem] = useState<VaultFile | null>(null)
  const [decryptPassword, setDecryptPassword] = useState('')
  const [decrypting, setDecrypting] = useState(false)
  const [contextCheck, setContextCheck] = useState<FileContextCheck | null>(null)
  const [checkingContext, setCheckingContext] = useState(false)

  const isVaultActive = useVaultStore((state) => state.isVaultActive)
  const isVerifyingVault = useVaultStore((state) => state.isVerifyingVault)
  const pushToast = useVaultStore((state) => state.pushToast)
  const selection = useFileStore((state) => state.selection)
  const syncFiles = useFileStore((state) => state.syncFiles)
  const purgeItems = useFileStore((state) => state.purgeItems)

  useEffect(() => {
    void loadFiles()
  }, [])

  const loadFiles = async () => {
    try {
      setLoading(true)
      const data = await listFiles()
      setFiles(data)
      syncFiles(data)
    } catch (error) {
      pushToast({
        title: 'Gallery unavailable',
        description: error instanceof Error ? error.message : 'Failed to load files',
        tone: 'error',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!decryptFileItem) {
      setContextCheck(null)
      setCheckingContext(false)
      return
    }

    let active = true
    setCheckingContext(true)

    void (async () => {
      try {
        const result = await checkFileContext(decryptFileItem.id, await getDeviceContext())
        if (active) {
          setContextCheck(result)
        }
      } catch (error) {
        if (!active) {
          return
        }

        setContextCheck(null)
        pushToast({
          title: 'Context check unavailable',
          description: error instanceof Error ? error.message : 'Unable to verify this file context',
          tone: 'warning',
        })
      } finally {
        if (active) {
          setCheckingContext(false)
        }
      }
    })()

    return () => {
      active = false
    }
  }, [decryptFileItem, pushToast])

  const decryptContextStatus = useMemo(() => {
    if (!decryptFileItem) {
      return {
        tone: 'checking' as const,
        label: 'Checking current device',
        detail: 'Preparing file context verification',
      }
    }

    if (checkingContext) {
      return {
        tone: 'checking' as const,
        label: 'Checking current device',
        detail: `${(decryptFileItem.steganographyMethod || 'lsb').toUpperCase()} method`,
      }
    }

    if (!contextCheck) {
      return {
        tone: 'checking' as const,
        label: 'Context status unavailable',
        detail: `${(decryptFileItem.steganographyMethod || 'lsb').toUpperCase()} method`,
      }
    }

    const hasStoredBinding = Object.values(contextCheck.signals).some((value) => value !== null)
    if (!hasStoredBinding) {
      return {
        tone: 'neutral' as const,
        label: 'No context lock',
        detail: 'This file is not restricted to a specific device context.',
      }
    }

    if (contextCheck.allowed) {
      return {
        tone: 'success' as const,
        label: 'Current device allowed',
        detail: `Context score ${(contextCheck.score * 100).toFixed(0)}%`,
      }
    }

    const mismatches = [
      contextCheck.signals.deviceFingerprint !== null && contextCheck.signals.deviceFingerprint < 0.98 ? 'device' : null,
      contextCheck.signals.timezone === false ? 'timezone' : null,
      contextCheck.signals.language === false ? 'language' : null,
      contextCheck.signals.userAgent === false ? 'browser signature' : null,
    ].filter(Boolean)

    return {
      tone: 'warning' as const,
      label: 'Context mismatch',
      detail:
        mismatches.length > 0
          ? `Mismatch detected in ${mismatches.join(', ')}.`
          : `Context score ${(contextCheck.score * 100).toFixed(0)}%`,
    }
  }, [checkingContext, contextCheck, decryptFileItem])

  const handleDelete = async (fileIds: string[]) => {
    try {
      await Promise.all(fileIds.map((fileId) => deleteFile(fileId)))
      const idSet = new Set(fileIds)
      setFiles((current) => current.filter((file) => !idSet.has(file.id)))
      purgeItems(fileIds)
      pushToast({
        title: 'Items removed',
        description: 'Selected carrier files were deleted permanently.',
        tone: 'success',
      })
    } catch (error) {
      pushToast({
        title: 'Delete failed',
        description: error instanceof Error ? error.message : 'Unable to delete file',
        tone: 'error',
      })
    }
  }

  const handleDecrypt = async (event: FormEvent) => {
    event.preventDefault()
    if (!decryptFileItem || !decryptPassword) {
      return
    }

    if (contextCheck && !contextCheck.allowed) {
      pushToast({
        title: 'Context mismatch',
        description: 'This file is bound to a different device or browser context.',
        tone: 'warning',
      })
      return
    }

    setDecrypting(true)
    try {
      const blob = await decryptFile(
        decryptFileItem.id,
        decryptPassword,
        await getDeviceContext(),
      )
      downloadBlob(blob, decryptFileItem.originalPayloadName)
      pushToast({
        title: 'Download ready',
        description: `${decryptFileItem.originalPayloadName} was decrypted successfully.`,
        tone: 'success',
      })
      setDecryptFileItem(null)
      setDecryptPassword('')
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 403) {
        pushToast({
          title: 'Decrypt blocked',
          description:
            error.contextScore !== undefined
              ? `This file rejected the current device context (${Math.round(error.contextScore * 100)}% match).`
              : 'This file rejected the current device context.',
          tone: 'warning',
        })
        return
      }

      pushToast({
        title: 'Decrypt failed',
        description: error instanceof Error ? error.message : 'Unable to decrypt file',
        tone: 'error',
      })
    } finally {
      setDecrypting(false)
    }
  }

  return (
    <section className="page-layout file-manager-page">
      <div className="file-manager-hero glass-panel">
        <div>
          <span className="eyebrow">{isVaultActive ? 'Private workspace' : 'Your files'}</span>
          <h1 className="hero-title file-manager-title">
            {isVaultActive
              ? 'Unlock secure file actions and manage protected items from one private workspace.'
              : 'Browse your files in a clean workspace that feels like a normal personal file manager.'}
          </h1>
        </div>
        <div className="hero-stats">
          <div className="hero-stat-card">
            <span className="hero-stat-label">Workspace items</span>
            <strong>{files.length.toString().padStart(2, '0')}</strong>
          </div>
          <div className="hero-stat-card">
            <span className="hero-stat-label">Vault layer</span>
            <strong>{isVaultActive ? 'Active' : 'Standard'}</strong>
          </div>
        </div>
      </div>

      <Toolbar onDeleteSelection={() => void handleDelete(selection.filter((itemId) => !itemId.startsWith('folder-')))} />
      <Breadcrumbs />

      {loading ? (
        <div className="orbit-loader-wrap">
          <div className="orbit-loader" />
        </div>
      ) : (
        <div className="file-manager-shell">
          {isVerifyingVault ? (
            <div className="vault-verifying">
              <div className="orbit-loader" />
              <p>Verifying fingerprint context...</p>
            </div>
          ) : (
            <FileWorkspace
              files={files}
              onDecrypt={setDecryptFileItem}
              onDeleteFiles={handleDelete}
            />
          )}
          <StatusBar visibleCount={files.length} />
        </div>
      )}

      <DecryptModal
        file={isVaultActive ? decryptFileItem : null}
        password={decryptPassword}
        onPasswordChange={setDecryptPassword}
        onClose={() => {
          setDecryptFileItem(null)
          setDecryptPassword('')
          setContextCheck(null)
        }}
        onSubmit={handleDecrypt}
        decrypting={decrypting}
        contextStatus={decryptContextStatus}
      />
    </section>
  )
}

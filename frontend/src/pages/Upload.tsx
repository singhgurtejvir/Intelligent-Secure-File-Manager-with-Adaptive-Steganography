import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import DropZone from '@/components/DropZone'
import CapacityMeter from '@/components/CapacityMeter'
import { uploadFile } from '@/utils/api'
import { getDeviceContext } from '@/utils/fingerprint'
import { useCapacity } from '@/hooks/useCapacity'
import { useVaultStore } from '@/store/vaultStore'
import { useFileStore } from '@/store/fileStore'
import { formatFileSize } from '@/utils/steganography'

export default function Upload() {
  const [carrierFile, setCarrierFile] = useState<File | null>(null)
  const [payloadFile, setPayloadFile] = useState<File | null>(null)
  const [carrierPreview, setCarrierPreview] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [contextLock, setContextLock] = useState(true)
  const [methodOverride, setMethodOverride] = useState('auto')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploading, setUploading] = useState(false)

  const navigate = useNavigate()
  const isVaultActive = useVaultStore((state) => state.isVaultActive)
  const pushToast = useVaultStore((state) => state.pushToast)
  const currentLocation = useFileStore((state) => state.currentLocation)
  const folders = useFileStore((state) => state.folders)
  const pendingUploadFolderId = useFileStore((state) => state.pendingUploadFolderId)
  const updateMetadata = useFileStore((state) => state.updateMetadata)
  const clearPendingUploadTarget = useFileStore((state) => state.clearPendingUploadTarget)
  const { maxPayload, usedPercent, method, status, isWithinCapacity } = useCapacity(carrierFile, payloadFile)

  const targetFolderId = pendingUploadFolderId ?? (currentLocation.kind === 'folder' ? currentLocation.folderId : null)
  const targetFolderName = targetFolderId
    ? folders.find((folder) => folder.id === targetFolderId)?.name || 'Current folder'
    : 'Home'

  useEffect(() => {
    if (!carrierFile) {
      setCarrierPreview(null)
      return
    }

    const preview = URL.createObjectURL(carrierFile)
    setCarrierPreview(preview)
    return () => URL.revokeObjectURL(preview)
  }, [carrierFile])

  useEffect(() => {
    return () => {
      clearPendingUploadTarget()
    }
  }, [clearPendingUploadTarget])

  const submitDisabled = useMemo(
    () => uploading || !carrierFile || !payloadFile || !password || password.length < 8 || !isWithinCapacity,
    [carrierFile, isWithinCapacity, password, payloadFile, uploading],
  )

  if (!isVaultActive) {
    return <Navigate to="/" replace />
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!carrierFile || !payloadFile) {
      return
    }

    if (password.length < 8) {
      pushToast({
        title: 'Passphrase too short',
        description: 'Use at least 8 characters to protect the payload.',
        tone: 'warning',
      })
      return
    }

    setUploading(true)
    setUploadProgress(0)

    try {
      const context = contextLock ? await getDeviceContext() : undefined
      const result = await uploadFile(
        carrierFile,
        payloadFile,
        password,
        {
          ...(context || {}),
          methodOverride,
        },
        setUploadProgress,
      )

      updateMetadata(result._id, { folderId: targetFolderId })
      clearPendingUploadTarget()

      pushToast({
        title: 'Embedded successfully',
        description: `Your carrier file was saved to ${targetFolderName}.`,
        tone: 'success',
      })

      window.setTimeout(() => navigate('/'), 800)
    } catch (error) {
      pushToast({
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'Unable to embed files',
        tone: 'error',
      })
    } finally {
      setUploading(false)
    }
  }

  return (
    <section className="page-layout upload-page">
      <div className="section-heading section-heading-compact">
        <div>
          <span className="eyebrow">Vault upload</span>
          <h1>Add a secure file to the private workspace.</h1>
          <p>Choose the visible carrier, attach the protected file, and save it directly into the current folder.</p>
        </div>
        <div className="upload-target-card">
          <span className="info-label">Destination</span>
          <strong>{targetFolderName}</strong>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="upload-grid upload-grid-refined">
        <DropZone
          label="Carrier image"
          description="Choose the image people are meant to see"
          accept="image/png,image/jpeg,image/webp,image/gif"
          file={carrierFile}
          previewUrl={carrierPreview}
          onSelect={setCarrierFile}
        />

        {carrierFile ? (
          <DropZone
            label="Hidden file"
            description="Attach the document or file to conceal"
            file={payloadFile}
            onSelect={setPayloadFile}
            compact
            dataRole="payload"
          />
        ) : (
          <div className="attachment-placeholder attachment-placeholder-refined">
            <span className="eyebrow">Hidden file</span>
            <p>Select a carrier image first to unlock the secure attachment panel.</p>
          </div>
        )}

        <div className="upload-panel glass-panel upload-panel-refined">
          <div className="upload-panel-row upload-panel-row-refined">
            <div>
              <span className="info-label">Carrier size</span>
              <strong>{carrierFile ? formatFileSize(carrierFile.size) : 'Waiting for image'}</strong>
            </div>
            <div>
              <span className="info-label">Payload ceiling</span>
              <strong>{carrierFile ? formatFileSize(maxPayload) : '--'}</strong>
            </div>
            <div>
              <span className="info-label">Placement</span>
              <strong>{targetFolderName}</strong>
            </div>
          </div>

          {carrierFile && payloadFile ? (
            <CapacityMeter usedPercent={usedPercent} method={method} status={status} />
          ) : null}

          <button
            type="button"
            className="advanced-toggle"
            onClick={() => setShowAdvanced((current) => !current)}
          >
            {showAdvanced ? 'Hide advanced options' : 'Show advanced options'}
          </button>

          {showAdvanced ? (
            <div className="advanced-panel">
              <label className="field">
                <span>Encryption password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="field-input"
                  placeholder="Minimum 8 characters"
                />
              </label>

              <label className="toggle-row">
                <span>Bind this upload to the current device context</span>
                <input
                  type="checkbox"
                  checked={contextLock}
                  onChange={(event) => setContextLock(event.target.checked)}
                />
              </label>

              <label className="field">
                <span>Method override</span>
                <select
                  value={methodOverride}
                  onChange={(event) => setMethodOverride(event.target.value)}
                  className="field-input"
                >
                  <option value="auto">Auto detect</option>
                  <option value="lsb">Force LSB</option>
                  <option value="dct">Force DCT</option>
                </select>
              </label>
            </div>
          ) : null}

          <button type="submit" className="button-primary upload-submit" disabled={submitDisabled}>
            {uploading ? `Embedding ${uploadProgress}%` : 'Add File To Workspace'}
          </button>
        </div>
      </form>
    </section>
  )
}

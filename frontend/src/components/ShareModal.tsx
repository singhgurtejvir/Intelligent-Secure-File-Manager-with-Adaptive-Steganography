import { FormEvent, useEffect, useMemo, useState } from 'react'
import { listSentShares, type ShareSummary, type VaultFile } from '@/utils/api'

function isProtectedFile(file: VaultFile | null) {
  return Boolean(file && file.storageMode !== 'plain' && file.steganographyMethod !== 'none')
}

export default function ShareModal({
  file,
  isVaultActive,
  creating,
  onClose,
  onSubmit,
}: {
  file: VaultFile | null
  isVaultActive: boolean
  creating: boolean
  onClose: () => void
  onSubmit: (input: {
    shareType: 'account' | 'link' | 'code'
    deliveryMode: 'plain-file' | 'embedded-carrier' | 'payload-file'
    recipientEmail?: string
    password?: string
  }) => Promise<void>
}) {
  const protectedFile = isProtectedFile(file)
  const [shareType, setShareType] = useState<'account' | 'link' | 'code'>('account')
  const [deliveryMode, setDeliveryMode] = useState<'plain-file' | 'embedded-carrier' | 'payload-file'>('plain-file')
  const [recipientEmail, setRecipientEmail] = useState('')
  const [password, setPassword] = useState('')
  const [history, setHistory] = useState<ShareSummary[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const deliveryOptions = useMemo(() => {
    if (!file) {
      return []
    }

    if (!protectedFile || !isVaultActive) {
      return [
        {
          value: 'plain-file' as const,
          label: 'Normal file',
          description: protectedFile
            ? 'Share the visible carrier just like a normal file from Your Files.'
            : 'Share the visible file just like a regular file manager item.',
        },
      ]
    }

    const options: Array<{
      value: 'plain-file' | 'embedded-carrier' | 'payload-file'
      label: string
      description: string
    }> = [
      {
        value: 'plain-file' as const,
        label: 'Without payload',
        description: 'Share only the normal visible carrier file with no extracted payload download.',
      },
      {
        value: 'payload-file' as const,
        label: 'Payload as normal file',
        description: 'Share the hidden payload itself as a regular downloadable file.',
      },
    ]

    if (file.steganographyMethod !== 'multi-file') {
      options.unshift({
        value: 'embedded-carrier' as const,
        label: 'With embedded data',
        description: 'Share the carrier file with the hidden data still embedded inside it.',
      })
    }

    return options
  }, [file, isVaultActive, protectedFile])

  useEffect(() => {
    if (!file) {
      return
    }

    setShareType('account')
    setRecipientEmail('')
    setPassword('')
    const nextMode: 'plain-file' | 'embedded-carrier' | 'payload-file' =
      protectedFile
        ? isVaultActive
          ? file.steganographyMethod === 'multi-file'
            ? 'plain-file'
            : 'embedded-carrier'
          : 'plain-file'
        : 'plain-file'
    setDeliveryMode(nextMode)
  }, [file, isVaultActive, protectedFile])

  useEffect(() => {
    if (!file) {
      return
    }

    let active = true
    setHistoryLoading(true)

    void (async () => {
      try {
        const shares = await listSentShares()
        if (active) {
          setHistory(shares.slice(0, 5))
        }
      } finally {
        if (active) {
          setHistoryLoading(false)
        }
      }
    })()

    return () => {
      active = false
    }
  }, [file])

  if (!file) {
    return null
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="decrypt-sheet share-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="decrypt-sheet-header">
          <div>
            <span className="eyebrow">Share file</span>
            <h2>{protectedFile && isVaultActive ? 'Create a secure share handoff.' : 'Share this file normally.'}</h2>
          </div>
          <button type="button" className="button-ghost" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="share-sheet-grid">
          <div className="info-card">
            <span className="info-subtle">Selected item</span>
            <strong>{protectedFile && isVaultActive ? file.originalPayloadName : file.carrierOriginalName}</strong>
            <span>
              {protectedFile
                ? isVaultActive
                  ? 'Protected vault item'
                  : 'Visible carrier file'
                : 'Standard visible file'}
            </span>
          </div>
          <div className="info-card">
            <span className="info-subtle">Available sharing</span>
            <strong>{protectedFile && isVaultActive ? 'Vault delivery choices' : 'Normal file delivery only'}</strong>
            <span>
              {protectedFile && isVaultActive
                ? 'Choose embedded carrier, payload file, or a normal visible file handoff.'
                : 'Only the normal visible file is shared from this view.'}
            </span>
          </div>
        </div>

        <form
          className="share-form"
          onSubmit={(event: FormEvent) => {
            event.preventDefault()
            void onSubmit({
              shareType,
              deliveryMode,
              recipientEmail: shareType === 'account' ? recipientEmail : undefined,
              password: protectedFile && deliveryMode === 'payload-file' ? password : undefined,
            })
          }}
        >
          <div className="share-options">
            <div className="share-section">
              <span className="info-subtle">How to share</span>
              <div className="share-pill-row">
                {([
                  { value: 'account', label: 'To account' },
                  { value: 'link', label: 'Create link' },
                  { value: 'code', label: 'Unique code' },
                ] as const).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`toolbar-toggle ${shareType === option.value ? 'toolbar-toggle-active' : ''}`}
                    onClick={() => setShareType(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="share-section">
              <span className="info-subtle">What the receiver gets</span>
              <div className="share-delivery-list">
                {deliveryOptions.map((option) => (
                  <label key={option.value} className={`share-choice ${deliveryMode === option.value ? 'share-choice-active' : ''}`}>
                    <input
                      type="radio"
                      name="deliveryMode"
                      value={option.value}
                      checked={deliveryMode === option.value}
                      onChange={() => setDeliveryMode(option.value)}
                    />
                    <div className="share-choice-copy">
                      <strong>{option.label}</strong>
                      <span>{option.description}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {shareType === 'account' ? (
              <label className="field">
                <span>Recipient account email</span>
                <input
                  type="email"
                  value={recipientEmail}
                  onChange={(event) => setRecipientEmail(event.target.value)}
                  className="field-input"
                  placeholder="receiver@example.com"
                />
              </label>
            ) : null}

            {protectedFile && deliveryMode === 'payload-file' ? (
              <label className="field">
                <span>Vault passphrase</span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="field-input"
                  placeholder="Required to prepare the decrypted payload"
                />
              </label>
            ) : null}
          </div>

          <div className="decrypt-form-actions">
            <button type="button" className="button-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="button-primary" disabled={creating}>
              {creating ? 'Creating share...' : 'Create Share'}
            </button>
          </div>
        </form>

        <div className="share-history">
          <div className="share-history-header">
            <span className="eyebrow">Recent shares</span>
            <span className="info-subtle">For quick demo proof</span>
          </div>
          {historyLoading ? (
            <p className="info-subtle">Loading recent shares...</p>
          ) : history.length > 0 ? (
            <div className="share-history-list">
              {history.map((share) => (
                <div key={share.id} className="share-history-card">
                  <strong>{share.downloadFileName}</strong>
                  <span>
                    {share.shareType === 'account'
                      ? `Account - ${share.recipientEmail || 'assigned'}`
                      : share.shareType === 'link'
                        ? 'Link share'
                        : `Code ${share.code || ''}`}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="info-subtle">No shares created yet from this workspace.</p>
          )}
        </div>
      </div>
    </div>
  )
}

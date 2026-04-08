import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  downloadCodeShare,
  downloadLinkShare,
  getCodeShare,
  getLinkShare,
  type ShareSummary,
} from '@/utils/api'
import { downloadBlob } from '@/utils/download'

export default function Receive() {
  const [params] = useSearchParams()
  const [mode, setMode] = useState<'link' | 'code'>(params.get('link') ? 'link' : 'code')
  const [linkToken, setLinkToken] = useState(params.get('link') || '')
  const [codeValue, setCodeValue] = useState('')
  const [share, setShare] = useState<ShareSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState('')

  const activeLookupValue = useMemo(
    () => (mode === 'link' ? linkToken.trim() : codeValue.trim().toUpperCase()),
    [codeValue, linkToken, mode],
  )

  useEffect(() => {
    if (!params.get('link')) {
      return
    }

    void handleLookup(params.get('link')!, 'link')
  }, [params])

  const handleLookup = async (value?: string, forcedMode?: 'link' | 'code') => {
    const nextMode = forcedMode || mode
    const nextValue = (value || activeLookupValue).trim()
    if (!nextValue) {
      return
    }

    try {
      setLoading(true)
      setError('')
      const result = nextMode === 'link' ? await getLinkShare(nextValue) : await getCodeShare(nextValue)
      setMode(nextMode)
      setShare(result)
      if (nextMode === 'link') {
        setLinkToken(nextValue)
      } else {
        setCodeValue(nextValue.toUpperCase())
      }
    } catch (lookupError) {
      setShare(null)
      setError(lookupError instanceof Error ? lookupError.message : 'Share not found')
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async () => {
    if (!share) {
      return
    }

    try {
      setDownloading(true)
      const blob =
        share.shareType === 'link'
          ? await downloadLinkShare(share.token || linkToken)
          : await downloadCodeShare(share.code || codeValue)
      downloadBlob(blob, share.downloadFileName)
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'Download failed')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <section className="auth-scene receive-scene">
      <div className="auth-shell glass-panel receive-shell">
        <span className="eyebrow">Receive shared file</span>
        <h1 className="auth-display">Redeem a link or unique code.</h1>
        <p className="auth-copy">
          Receivers can open a shared link directly or enter a unique access code. Account-to-account shares appear inside{' '}
          <Link to="/shared">Shared with me</Link> after sign-in.
        </p>

        <div className="share-pill-row receive-mode-row">
          <button
            type="button"
            className={`toolbar-toggle ${mode === 'link' ? 'toolbar-toggle-active' : ''}`}
            onClick={() => setMode('link')}
          >
            Shared link
          </button>
          <button
            type="button"
            className={`toolbar-toggle ${mode === 'code' ? 'toolbar-toggle-active' : ''}`}
            onClick={() => setMode('code')}
          >
            Unique code
          </button>
        </div>

        <form
          className="auth-form-modern"
          onSubmit={(event: FormEvent) => {
            event.preventDefault()
            void handleLookup()
          }}
        >
          <label className="field">
            <span>{mode === 'link' ? 'Link token' : 'Access code'}</span>
            <input
              type="text"
              value={mode === 'link' ? linkToken : codeValue}
              onChange={(event) =>
                mode === 'link' ? setLinkToken(event.target.value) : setCodeValue(event.target.value.toUpperCase())
              }
              className="field-input"
              placeholder={mode === 'link' ? 'Paste the link token or open via shared URL' : 'Enter the unique code'}
            />
          </label>

          {error ? <div className="inline-alert inline-alert-error">{error}</div> : null}

          <button type="submit" className="button-primary auth-submit" disabled={loading}>
            {loading ? 'Looking up...' : 'Find Share'}
          </button>
        </form>

        {share ? (
          <div className="receive-result glass-panel">
            <div className="receive-result-copy">
              <span className="eyebrow">{share.shareType === 'link' ? 'Link share' : 'Code share'}</span>
              <h2>{share.downloadFileName}</h2>
              <p>
                Delivery mode: {share.deliveryMode.replace('-', ' ')} · Created{' '}
                {new Date(share.createdAt).toLocaleString()}
              </p>
            </div>
            <button type="button" className="button-primary" onClick={() => void handleDownload()} disabled={downloading}>
              {downloading ? 'Downloading...' : 'Download Shared File'}
            </button>
          </div>
        ) : null}
      </div>
    </section>
  )
}

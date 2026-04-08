import { useEffect, useState } from 'react'
import { downloadReceivedShare, listReceivedShares, type ShareSummary } from '@/utils/api'
import { downloadBlob } from '@/utils/download'
import { useVaultStore } from '@/store/vaultStore'

export default function SharedInbox() {
  const [shares, setShares] = useState<ShareSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const pushToast = useVaultStore((state) => state.pushToast)

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true)
        const data = await listReceivedShares()
        setShares(data)
      } catch (error) {
        pushToast({
          title: 'Shared inbox unavailable',
          description: error instanceof Error ? error.message : 'Unable to load account shares',
          tone: 'error',
        })
      } finally {
        setLoading(false)
      }
    })()
  }, [pushToast])

  const handleDownload = async (share: ShareSummary) => {
    try {
      setDownloadingId(share.id)
      const blob = await downloadReceivedShare(share.id)
      downloadBlob(blob, share.downloadFileName)
      pushToast({
        title: 'Share retrieved',
        description: `${share.downloadFileName} was downloaded from your shared inbox.`,
        tone: 'success',
      })
    } catch (error) {
      pushToast({
        title: 'Download failed',
        description: error instanceof Error ? error.message : 'Unable to retrieve this share',
        tone: 'error',
      })
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <section className="page-layout shared-page">
      <div className="section-heading section-heading-compact">
        <div>
          <span className="eyebrow">Shared with me</span>
          <h1>Retrieve files another account sent to you.</h1>
        </div>
        <p>Account shares appear here after another user sends a file directly to your email-backed workspace.</p>
      </div>

      {loading ? (
        <div className="orbit-loader-wrap">
          <div className="orbit-loader" />
        </div>
      ) : shares.length > 0 ? (
        <div className="share-inbox-grid">
          {shares.map((share) => (
            <article key={share.id} className="glass-panel share-receive-card">
              <div className="share-receive-copy">
                <span className="eyebrow">{share.deliveryMode.replace('-', ' ')}</span>
                <h2>{share.downloadFileName}</h2>
                <p>From {share.fileName} · via direct account share</p>
                <span className="info-subtle">Received {new Date(share.createdAt).toLocaleString()}</span>
              </div>
              <button
                type="button"
                className="button-primary"
                onClick={() => void handleDownload(share)}
                disabled={downloadingId === share.id}
              >
                {downloadingId === share.id ? 'Preparing...' : 'Download'}
              </button>
            </article>
          ))}
        </div>
      ) : (
        <div className="glass-panel receive-empty-state">
          <h2>No account shares yet.</h2>
          <p>When another user shares a file directly to your account, it will appear here for download.</p>
        </div>
      )}
    </section>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { listFiles } from '@/utils/api'
import { getDeviceFingerprint } from '@/utils/fingerprint'
import { useAuthStore } from '@/store/authStore'
import { DEFAULT_VAULT_SHORTCUT, useVaultStore } from '@/store/vaultStore'
import {
  formatShortcut,
  getEventShortcutKey,
  isShortcutValid,
  normalizeShortcutKeys,
  serializeShortcut,
} from '@/utils/shortcut'

export default function Settings() {
  const [currentFingerprint, setCurrentFingerprint] = useState('Loading...')
  const [fileCount, setFileCount] = useState(0)
  const [isRecordingShortcut, setIsRecordingShortcut] = useState(false)
  const [recordingKeys, setRecordingKeys] = useState<string[]>([])
  const currentPressedKeysRef = useRef(new Set<string>())
  const capturedKeysRef = useRef<string[]>([])

  const { email, recoveryKey } = useAuthStore()
  const isVaultActive = useVaultStore((state) => state.isVaultActive)
  const vaultShortcut = useVaultStore((state) => state.vaultShortcut)
  const setVaultShortcut = useVaultStore((state) => state.setVaultShortcut)
  const setRecordingShortcut = useVaultStore((state) => state.setRecordingShortcut)
  const pushToast = useVaultStore((state) => state.pushToast)

  useEffect(() => {
    void getDeviceFingerprint().then(setCurrentFingerprint)
    void listFiles().then((files) => setFileCount(files.length)).catch(() => setFileCount(0))
  }, [])

  useEffect(() => {
    if (!isRecordingShortcut) {
      setRecordingShortcut(false)
      currentPressedKeysRef.current.clear()
      capturedKeysRef.current = []
      setRecordingKeys([])
      return
    }

    setRecordingShortcut(true)

    const finalizeRecording = () => {
      const candidate = normalizeShortcutKeys(capturedKeysRef.current)
      setRecordingShortcut(false)
      setIsRecordingShortcut(false)
      currentPressedKeysRef.current.clear()
      capturedKeysRef.current = []

      if (candidate.length === 0) {
        setRecordingKeys([])
        return
      }

      if (!isShortcutValid(candidate)) {
        setRecordingKeys(candidate)
        pushToast({
          title: 'Shortcut not saved',
          description: 'Use 3 to 6 keys total, include Ctrl and Shift, and add at least one other key.',
          tone: 'warning',
        })
        return
      }

      const nextShortcut = serializeShortcut(candidate)
      setVaultShortcut(nextShortcut)
      setRecordingKeys(candidate)
      pushToast({
        title: 'Shortcut updated',
        description: `Vault trigger set to ${formatShortcut(nextShortcut)}.`,
        tone: 'success',
      })
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      event.preventDefault()
      event.stopPropagation()

      const key = getEventShortcutKey(event)
      if (!key) {
        return
      }

      currentPressedKeysRef.current.add(key)
      const normalized = normalizeShortcutKeys(currentPressedKeysRef.current)
      capturedKeysRef.current = normalized
      setRecordingKeys(normalized)
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      event.preventDefault()
      event.stopPropagation()

      const key = getEventShortcutKey(event)
      if (key) {
        currentPressedKeysRef.current.delete(key)
      }

      if (currentPressedKeysRef.current.size === 0) {
        finalizeRecording()
      }
    }

    const handleWindowBlur = () => {
      finalizeRecording()
    }

    window.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('keyup', handleKeyUp, true)
    window.addEventListener('blur', handleWindowBlur)

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('keyup', handleKeyUp, true)
      window.removeEventListener('blur', handleWindowBlur)
      setRecordingShortcut(false)
    }
  }, [isRecordingShortcut, pushToast, setRecordingShortcut, setVaultShortcut])

  useEffect(() => {
    return () => {
      setRecordingShortcut(false)
    }
  }, [setRecordingShortcut])

  const shortcutDescription = useMemo(
    () => formatShortcut(vaultShortcut),
    [vaultShortcut],
  )

  const recordingDescription = useMemo(() => {
    if (!isRecordingShortcut) {
      return shortcutDescription
    }

    if (recordingKeys.length === 0) {
      return 'Press and hold your shortcut now'
    }

    return formatShortcut(serializeShortcut(recordingKeys))
  }, [isRecordingShortcut, recordingKeys, shortcutDescription])

  return (
    <section className="page-layout settings-page settings-page-refined">
      <div className="section-heading section-heading-compact narrow">
        <span className="eyebrow">Settings</span>
        <h1>Refine how the workspace, vault trigger, and device trust behave after sign-in.</h1>
      </div>

      <div className="settings-stack settings-stack-refined">
        <section className="glass-panel settings-card settings-card-refined">
          <div className="settings-card-heading">
            <div>
              <span className="eyebrow">Vault access</span>
              <h2>Trigger and launch controls</h2>
            </div>
            <span className="settings-inline-note">Hidden while the vault is locked</span>
          </div>

          {isVaultActive ? (
            <div className="settings-grid settings-grid-refined">
              <div className="info-card">
                <span className="info-label">Current shortcut</span>
                <strong>{shortcutDescription}</strong>
                <span className="info-subtle">Use 3 to 6 keys total. Ctrl and Shift are required in every shortcut.</span>
              </div>
              <div className="settings-field-card shortcut-settings-card">
                <span className="info-label">Record shortcut</span>
                <button
                  type="button"
                  className={`shortcut-recorder ${isRecordingShortcut ? 'shortcut-recorder-active' : ''}`}
                  onClick={() => {
                    if (isRecordingShortcut) {
                      setRecordingShortcut(false)
                      setIsRecordingShortcut(false)
                      setRecordingKeys([])
                      currentPressedKeysRef.current.clear()
                      capturedKeysRef.current = []
                      return
                    }

                    setRecordingKeys([])
                    currentPressedKeysRef.current.clear()
                    capturedKeysRef.current = []
                    setIsRecordingShortcut(true)
                  }}
                >
                  {recordingDescription}
                </button>
                <span className="settings-inline-note shortcut-hint">
                  {isRecordingShortcut
                    ? 'Keep the keys held together, then release to save the shortcut.'
                    : 'Examples: Ctrl + Shift + V, Ctrl + Shift + K + L, Ctrl + Shift + 1 + 2'}
                </span>
                <button
                  type="button"
                  className="button-ghost shortcut-reset"
                  onClick={() => {
                    setVaultShortcut(DEFAULT_VAULT_SHORTCUT)
                    setRecordingKeys([])
                    pushToast({
                      title: 'Shortcut reset',
                      description: `Vault trigger restored to ${formatShortcut(DEFAULT_VAULT_SHORTCUT)}.`,
                      tone: 'info',
                    })
                  }}
                >
                  Reset to default
                </button>
              </div>
            </div>
          ) : (
            <div className="info-card shortcut-hidden-card">
              <span className="info-label">Vault shortcut</span>
              <strong>Hidden while vault is locked</strong>
              <span className="info-subtle">Enter vault mode first if you want to view or change the launch shortcut.</span>
            </div>
          )}
        </section>

        <section className="glass-panel settings-card settings-card-refined">
          <div className="settings-card-heading">
            <div>
              <span className="eyebrow">Device fingerprint</span>
              <h2>Current trusted signature</h2>
            </div>
            <span className="settings-inline-note">Checked during vault access</span>
          </div>
          <code className="fingerprint-code">{currentFingerprint}</code>
          <div className="settings-grid settings-grid-refined">
            <div className="info-card">
              <span className="info-label">Threshold</span>
              <strong>0.75 fuzzy match</strong>
            </div>
            <div className="info-card">
              <span className="info-label">Registered vault items</span>
              <strong>{fileCount}</strong>
            </div>
          </div>
        </section>

        <section className="glass-panel settings-card settings-card-refined">
          <div className="settings-card-heading">
            <div>
              <span className="eyebrow">Workspace</span>
              <h2>Presentation defaults</h2>
            </div>
          </div>
          <div className="settings-grid settings-grid-refined">
            <div className="info-card">
              <span className="info-label">Uploads</span>
              <strong>Respect current folder context</strong>
              <span className="info-subtle">Using “Add File” inside a folder now targets that folder automatically.</span>
            </div>
            <div className="info-card">
              <span className="info-label">Shell</span>
              <strong>Compact typography</strong>
              <span className="info-subtle">Large hero copy was reduced for a cleaner file-manager feel.</span>
            </div>
          </div>
        </section>

        <section className="glass-panel settings-card settings-card-refined">
          <div className="settings-card-heading">
            <div>
              <span className="eyebrow">Decoy content</span>
              <h2>Unauthorized responses</h2>
            </div>
          </div>
          <p className="settings-paragraph">
            Fingerprint mismatches quietly return decoy content instead of revealing the protected file, preserving the gallery persona.
          </p>
        </section>

        <section className="glass-panel settings-card danger-card settings-card-refined">
          <div className="settings-card-heading">
            <div>
              <span className="eyebrow">Account</span>
              <h2>Recovery and identity</h2>
            </div>
          </div>
          <p className="settings-paragraph">Signed in as {email || 'unknown'}.</p>
          <p className="settings-copy">Recovery key</p>
          <code className="fingerprint-code">{recoveryKey || 'Not available'}</code>
        </section>
      </div>
    </section>
  )
}

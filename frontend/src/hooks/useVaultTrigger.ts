import { useCallback, useEffect, useMemo, useRef } from 'react'
import { getDeviceFingerprint } from '@/utils/fingerprint'
import { useVaultStore } from '@/store/vaultStore'
import { getEventShortcutKey, shortcutMatchesPressedKeys } from '@/utils/shortcut'

const HOLD_DURATION_MS = 800

export function useVaultTrigger() {
  const timeoutRef = useRef<number | null>(null)
  const pressedKeysRef = useRef(new Set<string>())
  const triggerLockedRef = useRef(false)
  const activateVault = useVaultStore((state) => state.activateVault)
  const deactivateVault = useVaultStore((state) => state.deactivateVault)
  const isVaultActive = useVaultStore((state) => state.isVaultActive)
  const isRecordingShortcut = useVaultStore((state) => state.isRecordingShortcut)
  const setVerifyingVault = useVaultStore((state) => state.setVerifyingVault)
  const registeredFingerprint = useVaultStore((state) => state.registeredFingerprint)
  const vaultShortcut = useVaultStore((state) => state.vaultShortcut)

  const toggleVault = useCallback(async () => {
    if (isVaultActive) {
      deactivateVault()
      return
    }

    setVerifyingVault(true)
    const fingerprint = await getDeviceFingerprint()
    activateVault(fingerprint)
  }, [activateVault, deactivateVault, isVaultActive, setVerifyingVault])

  const startHold = useCallback(() => {
    window.clearTimeout(timeoutRef.current ?? undefined)
    timeoutRef.current = window.setTimeout(() => {
      void toggleVault()
    }, HOLD_DURATION_MS)
  }, [toggleVault])

  const cancelHold = useCallback(() => {
    window.clearTimeout(timeoutRef.current ?? undefined)
    timeoutRef.current = null
  }, [])

  useEffect(() => {
    const clearPressedKeys = () => {
      pressedKeysRef.current.clear()
      triggerLockedRef.current = false
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isRecordingShortcut) {
        return
      }

      const key = getEventShortcutKey(event)
      if (!key) {
        return
      }

      pressedKeysRef.current.add(key)

      if (!triggerLockedRef.current && shortcutMatchesPressedKeys(vaultShortcut, pressedKeysRef.current)) {
        event.preventDefault()
        triggerLockedRef.current = true
        void toggleVault()
      }
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      const key = getEventShortcutKey(event)
      if (key) {
        pressedKeysRef.current.delete(key)
      }

      if (pressedKeysRef.current.size === 0) {
        triggerLockedRef.current = false
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', clearPressedKeys)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', clearPressedKeys)
      clearPressedKeys()
      cancelHold()
    }
  }, [cancelHold, isRecordingShortcut, toggleVault, vaultShortcut])

  return useMemo(
    () => ({
      isVaultActive,
      registeredFingerprint,
      vaultShortcut,
      startHold,
      cancelHold,
      toggleVault,
    }),
    [cancelHold, isVaultActive, registeredFingerprint, startHold, toggleVault, vaultShortcut],
  )
}

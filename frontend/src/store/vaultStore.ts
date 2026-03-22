import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { sanitizeStoredShortcut } from '@/utils/shortcut'

export type ToastTone = 'success' | 'warning' | 'error' | 'info'
export const DEFAULT_VAULT_SHORTCUT = 'Ctrl+Shift+V'

export interface ToastItem {
  id: string
  title: string
  description?: string
  tone: ToastTone
}

interface VaultStore {
  isVaultActive: boolean
  isVerifyingVault: boolean
  isRecordingShortcut: boolean
  registeredFingerprint: string | null
  vaultShortcut: string
  toasts: ToastItem[]
  activateVault: (fingerprint?: string | null) => void
  deactivateVault: () => void
  setVerifyingVault: (value: boolean) => void
  setRecordingShortcut: (value: boolean) => void
  setVaultShortcut: (shortcut: string) => void
  pushToast: (toast: Omit<ToastItem, 'id'>) => void
  removeToast: (id: string) => void
}

export const useVaultStore = create<VaultStore>()(
  persist(
    (set) => ({
      isVaultActive: false,
      isVerifyingVault: false,
      isRecordingShortcut: false,
      registeredFingerprint: null,
      vaultShortcut: DEFAULT_VAULT_SHORTCUT,
      toasts: [],
      activateVault: (fingerprint) =>
        set({
          isVaultActive: true,
          isVerifyingVault: false,
          registeredFingerprint: fingerprint ?? null,
        }),
      deactivateVault: () =>
        set({
          isVaultActive: false,
          isVerifyingVault: false,
        }),
      setVerifyingVault: (value) =>
        set({
          isVerifyingVault: value,
        }),
      setRecordingShortcut: (value) =>
        set({
          isRecordingShortcut: value,
        }),
      setVaultShortcut: (shortcut) =>
        set({
          vaultShortcut: sanitizeStoredShortcut(shortcut, DEFAULT_VAULT_SHORTCUT),
        }),
      pushToast: (toast) =>
        set((state) => ({
          toasts: [...state.toasts, { id: crypto.randomUUID(), ...toast }],
        })),
      removeToast: (id) =>
        set((state) => ({
          toasts: state.toasts.filter((toast) => toast.id !== id),
        })),
    }),
    {
      name: 'vault-store',
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<VaultStore> | undefined
        return {
          ...currentState,
          ...persisted,
          isRecordingShortcut: false,
          vaultShortcut: sanitizeStoredShortcut(
            persisted?.vaultShortcut,
            currentState.vaultShortcut,
          ),
        }
      },
      partialize: (state) => ({
        registeredFingerprint: state.registeredFingerprint,
        vaultShortcut: state.vaultShortcut,
      }),
    },
  ),
)

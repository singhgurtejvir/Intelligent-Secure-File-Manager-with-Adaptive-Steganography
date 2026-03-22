import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ViewMode = 'grid' | 'list' | 'detail'

interface UiStore {
  viewMode: ViewMode
  sidebarCollapsed: boolean
  metadataEditorFileId: string | null
  setViewMode: (mode: ViewMode) => void
  toggleSidebar: () => void
  openMetadataEditor: (fileId: string) => void
  closeMetadataEditor: () => void
}

export const useUiStore = create<UiStore>()(
  persist(
    (set) => ({
      viewMode: 'grid',
      sidebarCollapsed: false,
      metadataEditorFileId: null,
      setViewMode: (mode) => set({ viewMode: mode }),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      openMetadataEditor: (fileId) => set({ metadataEditorFileId: fileId }),
      closeMetadataEditor: () => set({ metadataEditorFileId: null }),
    }),
    {
      name: 'ui-store',
    },
  ),
)

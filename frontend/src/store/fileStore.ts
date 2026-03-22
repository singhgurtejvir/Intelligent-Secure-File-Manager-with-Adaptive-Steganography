import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { VaultFile } from '@/utils/api'

export type SpecialLocation = 'home' | 'recent' | 'starred' | 'trash'
export type ManagerLocation =
  | { kind: SpecialLocation }
  | { kind: 'folder'; folderId: string }

export interface FolderItem {
  id: string
  name: string
  parentId: string | null
  createdAt: string
  starred?: boolean
  trashedAt?: string | null
}

export interface FileMeta {
  folderId: string | null
  aliasName?: string
  caption?: string
  tags: string[]
  starred?: boolean
  trashedAt?: string | null
}

export interface ClipboardState {
  mode: 'cut' | 'copy'
  itemIds: string[]
}

interface FileStore {
  files: VaultFile[]
  fileMeta: Record<string, FileMeta>
  folders: FolderItem[]
  selection: string[]
  currentLocation: ManagerLocation
  clipboard: ClipboardState | null
  viewerFileId: string | null
  detailId: string | null
  searchQuery: string
  pendingUploadFolderId: string | null
  syncFiles: (files: VaultFile[]) => void
  createFolder: (name: string, parentId?: string | null) => string
  renameItem: (itemId: string, name: string) => void
  moveItems: (itemIds: string[], targetFolderId: string | null) => void
  setLocation: (location: ManagerLocation) => void
  setSelection: (selection: string[]) => void
  toggleSelection: (itemId: string) => void
  clearSelection: () => void
  setClipboard: (clipboard: ClipboardState | null) => void
  markStarred: (itemId: string) => void
  moveToTrash: (itemIds: string[]) => void
  restoreFromTrash: (itemIds: string[]) => void
  removeFiles: (itemIds: string[]) => void
  purgeItems: (itemIds: string[]) => void
  emptyTrash: () => void
  updateMetadata: (fileId: string, updates: Partial<FileMeta>) => void
  openViewer: (fileId: string) => void
  closeViewer: () => void
  setDetailId: (itemId: string | null) => void
  setSearchQuery: (query: string) => void
  setPendingUploadTarget: (folderId: string | null) => void
  clearPendingUploadTarget: () => void
}

const DEFAULT_FOLDERS: FolderItem[] = [
  {
    id: 'folder-summer',
    name: 'Summer',
    parentId: null,
    createdAt: '2026-03-01T09:00:00.000Z',
  },
  {
    id: 'folder-work',
    name: 'Work',
    parentId: null,
    createdAt: '2026-03-03T09:00:00.000Z',
  },
  {
    id: 'folder-family',
    name: 'Family',
    parentId: null,
    createdAt: '2026-03-06T09:00:00.000Z',
  },
]

function sanitizeName(name: string) {
  return name.trim().replace(/\s+/g, ' ')
}

function duplicateMeta(meta?: FileMeta): FileMeta {
  return {
    folderId: meta?.folderId ?? null,
    aliasName: meta?.aliasName,
    caption: meta?.caption,
    tags: meta?.tags ? [...meta.tags] : [],
    starred: meta?.starred ?? false,
    trashedAt: meta?.trashedAt ?? null,
  }
}

function updateFolderTreeTrash(
  folders: FolderItem[],
  itemIds: string[],
  trashedAt: string | null,
): FolderItem[] {
  const targets = new Set(itemIds.filter((itemId) => itemId.startsWith('folder-')))
  if (targets.size === 0) {
    return folders
  }

  const allTargets = new Set<string>(targets)
  let foundChildren = true
  while (foundChildren) {
    foundChildren = false
    for (const folder of folders) {
      if (folder.parentId && allTargets.has(folder.parentId) && !allTargets.has(folder.id)) {
        allTargets.add(folder.id)
        foundChildren = true
      }
    }
  }

  return folders.map((folder) =>
    allTargets.has(folder.id)
      ? {
          ...folder,
          trashedAt,
        }
      : folder,
  )
}

export const useFileStore = create<FileStore>()(
  persist(
    (set) => ({
      files: [],
      fileMeta: {},
      folders: DEFAULT_FOLDERS,
      selection: [],
      currentLocation: { kind: 'home' },
      clipboard: null,
      viewerFileId: null,
      detailId: null,
      searchQuery: '',
      pendingUploadFolderId: null,
      syncFiles: (files) =>
        set((state) => {
          const nextMeta: Record<string, FileMeta> = {}
          for (const file of files) {
            nextMeta[file.id] = duplicateMeta(state.fileMeta[file.id])
          }

          return {
            files,
            fileMeta: nextMeta,
            selection: state.selection.filter((itemId) => files.some((file) => file.id === itemId)),
            detailId:
              state.detailId && (files.some((file) => file.id === state.detailId) || state.detailId.startsWith('folder-'))
                ? state.detailId
                : null,
            viewerFileId:
              state.viewerFileId && files.some((file) => file.id === state.viewerFileId)
                ? state.viewerFileId
                : null,
          }
        }),
      createFolder: (name, parentId = null) => {
        const folderName = sanitizeName(name) || 'Untitled Folder'
        const folderId = `folder-${crypto.randomUUID()}`
        set((state) => ({
          folders: [
            ...state.folders,
            {
              id: folderId,
              name: folderName,
              parentId,
              createdAt: new Date().toISOString(),
            },
          ],
          currentLocation: parentId ? { kind: 'folder', folderId: parentId } : state.currentLocation,
        }))
        return folderId
      },
      renameItem: (itemId, name) =>
        set((state) => {
          const nextName = sanitizeName(name)
          if (!nextName) {
            return state
          }

          if (itemId.startsWith('folder-')) {
            return {
              folders: state.folders.map((folder) =>
                folder.id === itemId
                  ? {
                      ...folder,
                      name: nextName,
                    }
                  : folder,
              ),
            }
          }

          return {
            fileMeta: {
              ...state.fileMeta,
              [itemId]: {
                ...duplicateMeta(state.fileMeta[itemId]),
                aliasName: nextName,
              },
            },
          }
        }),
      moveItems: (itemIds, targetFolderId) =>
        set((state) => {
          const targetIds = new Set(itemIds)
          return {
            fileMeta: Object.fromEntries(
              Object.entries(state.fileMeta).map(([fileId, meta]) => [
                fileId,
                targetIds.has(fileId)
                  ? {
                      ...duplicateMeta(meta),
                      folderId: targetFolderId,
                    }
                  : meta,
              ]),
            ),
            folders: state.folders.map((folder) =>
              targetIds.has(folder.id)
                ? {
                    ...folder,
                    parentId: targetFolderId,
                  }
                : folder,
            ),
            clipboard: null,
          }
        }),
      setLocation: (location) =>
        set({
          currentLocation: location,
          selection: [],
          detailId: null,
          searchQuery: '',
        }),
      setSelection: (selection) =>
        set({
          selection,
          detailId: selection.length === 1 ? selection[0] : null,
        }),
      toggleSelection: (itemId) =>
        set((state) => {
          const exists = state.selection.includes(itemId)
          const selection = exists
            ? state.selection.filter((value) => value !== itemId)
            : [...state.selection, itemId]

          return {
            selection,
            detailId: selection.length === 1 ? selection[0] : state.detailId,
          }
        }),
      clearSelection: () =>
        set({
          selection: [],
        }),
      setClipboard: (clipboard) =>
        set({
          clipboard,
        }),
      markStarred: (itemId) =>
        set((state) => {
          if (itemId.startsWith('folder-')) {
            return {
              folders: state.folders.map((folder) =>
                folder.id === itemId
                  ? {
                      ...folder,
                      starred: !folder.starred,
                    }
                  : folder,
              ),
            }
          }

          return {
            fileMeta: {
              ...state.fileMeta,
              [itemId]: {
                ...duplicateMeta(state.fileMeta[itemId]),
                starred: !state.fileMeta[itemId]?.starred,
              },
            },
          }
        }),
      moveToTrash: (itemIds) =>
        set((state) => {
          const now = new Date().toISOString()
          const itemSet = new Set(itemIds)
          const nextMeta = Object.fromEntries(
            Object.entries(state.fileMeta).map(([fileId, meta]) => [
              fileId,
              itemSet.has(fileId)
                ? {
                    ...duplicateMeta(meta),
                    trashedAt: now,
                  }
                : meta,
            ]),
          )

          return {
            fileMeta: nextMeta,
            folders: updateFolderTreeTrash(state.folders, itemIds, now),
            selection: [],
          }
        }),
      restoreFromTrash: (itemIds) =>
        set((state) => {
          const itemSet = new Set(itemIds)
          const nextMeta = Object.fromEntries(
            Object.entries(state.fileMeta).map(([fileId, meta]) => [
              fileId,
              itemSet.has(fileId)
                ? {
                    ...duplicateMeta(meta),
                    trashedAt: null,
                  }
                : meta,
            ]),
          )

          return {
            fileMeta: nextMeta,
            folders: updateFolderTreeTrash(state.folders, itemIds, null),
            selection: [],
          }
        }),
      removeFiles: (itemIds) =>
        set((state) => {
          const fileSet = new Set(itemIds)
          return {
            files: state.files.filter((file) => !fileSet.has(file.id)),
            fileMeta: Object.fromEntries(
              Object.entries(state.fileMeta).filter(([fileId]) => !fileSet.has(fileId)),
            ),
            selection: state.selection.filter((itemId) => !fileSet.has(itemId)),
            detailId: state.detailId && fileSet.has(state.detailId) ? null : state.detailId,
            viewerFileId: state.viewerFileId && fileSet.has(state.viewerFileId) ? null : state.viewerFileId,
          }
        }),
      purgeItems: (itemIds) =>
        set((state) => {
          const itemSet = new Set(itemIds)
          const folderIds = itemIds.filter((itemId) => itemId.startsWith('folder-'))
          const descendantFolders = new Set(folderIds)

          let foundChildren = true
          while (foundChildren) {
            foundChildren = false
            for (const folder of state.folders) {
              if (folder.parentId && descendantFolders.has(folder.parentId) && !descendantFolders.has(folder.id)) {
                descendantFolders.add(folder.id)
                foundChildren = true
              }
            }
          }

          return {
            folders: state.folders.filter((folder) => !descendantFolders.has(folder.id)),
            files: state.files.filter((file) => !itemSet.has(file.id)),
            fileMeta: Object.fromEntries(
              Object.entries(state.fileMeta).filter(([fileId]) => !itemSet.has(fileId)),
            ),
            selection: state.selection.filter((itemId) => !itemSet.has(itemId) && !descendantFolders.has(itemId)),
            detailId:
              state.detailId && (itemSet.has(state.detailId) || descendantFolders.has(state.detailId))
                ? null
                : state.detailId,
            viewerFileId:
              state.viewerFileId && itemSet.has(state.viewerFileId)
                ? null
                : state.viewerFileId,
          }
        }),
      emptyTrash: () =>
        set((state) => ({
          folders: state.folders.filter((folder) => !folder.trashedAt),
          fileMeta: Object.fromEntries(
            Object.entries(state.fileMeta).map(([fileId, meta]) => [
              fileId,
              meta.trashedAt ? { ...duplicateMeta(meta), trashedAt: null } : meta,
            ]),
          ),
          selection: [],
        })),
      updateMetadata: (fileId, updates) =>
        set((state) => ({
          fileMeta: {
            ...state.fileMeta,
            [fileId]: {
              ...duplicateMeta(state.fileMeta[fileId]),
              ...updates,
              tags: updates.tags ? [...updates.tags] : duplicateMeta(state.fileMeta[fileId]).tags,
            },
          },
        })),
      openViewer: (fileId) =>
        set({
          viewerFileId: fileId,
          detailId: fileId,
        }),
      closeViewer: () =>
        set({
          viewerFileId: null,
        }),
      setDetailId: (itemId) =>
        set({
          detailId: itemId,
        }),
      setSearchQuery: (query) =>
        set({
          searchQuery: query,
        }),
      setPendingUploadTarget: (folderId) =>
        set({
          pendingUploadFolderId: folderId,
        }),
      clearPendingUploadTarget: () =>
        set({
          pendingUploadFolderId: null,
        }),
    }),
    {
      name: 'file-store',
      partialize: (state) => ({
        fileMeta: state.fileMeta,
        folders: state.folders,
        currentLocation: state.currentLocation,
        pendingUploadFolderId: state.pendingUploadFolderId,
      }),
    },
  ),
)

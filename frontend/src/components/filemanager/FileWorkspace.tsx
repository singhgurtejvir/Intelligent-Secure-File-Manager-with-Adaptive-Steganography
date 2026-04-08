import { DragEvent, FormEvent, MouseEvent, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { createPortal } from 'react-dom'
import CarrierImage from '@/components/common/CarrierImage'
import MetadataEditor from '@/components/editors/MetadataEditor'
import FileViewer from '@/components/viewer/FileViewer'
import { useFileStore, type FileMeta, type FolderItem } from '@/store/fileStore'
import { useUiStore } from '@/store/uiStore'
import { useVaultStore } from '@/store/vaultStore'
import type { VaultFile } from '@/utils/api'

type WorkspaceItem =
  | (FolderItem & {
      kind: 'folder'
      itemCount: number
    })
  | (VaultFile & {
      kind: 'file'
      meta: FileMeta
      displayName: string
    })

function displayCarrierName(file: VaultFile, meta: FileMeta | undefined, isVaultActive: boolean) {
  if (isVaultActive) {
    return file.name
  }

  return meta?.aliasName || file.carrierOriginalName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ')
}

function isFileItem(item: WorkspaceItem): item is Extract<WorkspaceItem, { kind: 'file' }> {
  return item.kind === 'file'
}

function isProtectedFile(item: VaultFile): boolean {
  return item.storageMode !== 'plain' && item.steganographyMethod !== 'none'
}

export default function FileWorkspace({
  files,
  onDecrypt,
  onShare,
  onDeleteFiles,
}: {
  files: VaultFile[]
  onDecrypt: (file: VaultFile) => void
  onShare: (file: VaultFile) => void
  onDeleteFiles: (fileIds: string[]) => Promise<void>
}) {
  const isVaultActive = useVaultStore((state) => state.isVaultActive)
  const pushToast = useVaultStore((state) => state.pushToast)
  const fileMeta = useFileStore((state) => state.fileMeta)
  const folders = useFileStore((state) => state.folders)
  const currentLocation = useFileStore((state) => state.currentLocation)
  const selection = useFileStore((state) => state.selection)
  const viewerFileId = useFileStore((state) => state.viewerFileId)
  const detailId = useFileStore((state) => state.detailId)
  const searchQuery = useFileStore((state) => state.searchQuery)
  const clipboard = useFileStore((state) => state.clipboard)
  const setSelection = useFileStore((state) => state.setSelection)
  const toggleSelection = useFileStore((state) => state.toggleSelection)
  const setClipboard = useFileStore((state) => state.setClipboard)
  const moveItems = useFileStore((state) => state.moveItems)
  const moveToTrash = useFileStore((state) => state.moveToTrash)
  const restoreFromTrash = useFileStore((state) => state.restoreFromTrash)
  const markStarred = useFileStore((state) => state.markStarred)
  const setLocation = useFileStore((state) => state.setLocation)
  const openViewer = useFileStore((state) => state.openViewer)
  const closeViewer = useFileStore((state) => state.closeViewer)
  const setDetailId = useFileStore((state) => state.setDetailId)
  const renameItem = useFileStore((state) => state.renameItem)
  const updateMetadata = useFileStore((state) => state.updateMetadata)
  const clearSelection = useFileStore((state) => state.clearSelection)
  const purgeItems = useFileStore((state) => state.purgeItems)
  const viewMode = useUiStore((state) => state.viewMode)
  const metadataEditorFileId = useUiStore((state) => state.metadataEditorFileId)
  const openMetadataEditor = useUiStore((state) => state.openMetadataEditor)
  const closeMetadataEditor = useUiStore((state) => state.closeMetadataEditor)

  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null)

  const filesById = useMemo(
    () => new Map(files.map((file) => [file.id, file])),
    [files],
  )

  const derivedFolders = useMemo(
    () =>
      folders.map((folder) => ({
        ...folder,
        kind: 'folder' as const,
        itemCount:
          folders.filter((child) => child.parentId === folder.id && !child.trashedAt).length +
          files.filter(
            (file) => fileMeta[file.id]?.folderId === folder.id && !fileMeta[file.id]?.trashedAt,
          ).length,
      })),
    [fileMeta, files, folders],
  )

  const visibleItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    const currentFolderId = currentLocation.kind === 'folder' ? currentLocation.folderId : null
    const folderChildren = (parentId: string | null) =>
      derivedFolders.filter((folder) => folder.parentId === parentId)

    const fileItems = files.map((file) => ({
      ...file,
      kind: 'file' as const,
      meta: fileMeta[file.id] || { folderId: null, tags: [] },
      displayName: displayCarrierName(file, fileMeta[file.id], isVaultActive),
    }))

    let baseItems: WorkspaceItem[] = []

    if (query) {
      baseItems = [
        ...derivedFolders.filter((folder) => !folder.trashedAt && folder.name.toLowerCase().includes(query)),
        ...fileItems.filter(
          (file) =>
            !file.meta.trashedAt &&
            [
              file.displayName,
              file.name,
              file.originalPayloadName,
              file.carrierOriginalName,
            ]
              .join(' ')
              .toLowerCase()
              .includes(query),
        ),
      ]
    } else if (currentLocation.kind === 'home') {
      baseItems = [
        ...folderChildren(null).filter((folder) => !folder.trashedAt),
        ...fileItems.filter((file) => !file.meta.trashedAt && !file.meta.folderId),
      ]
    } else if (currentLocation.kind === 'recent') {
      baseItems = fileItems
        .filter((file) => !file.meta.trashedAt)
        .sort((left, right) => +new Date(right.createdAt) - +new Date(left.createdAt))
    } else if (currentLocation.kind === 'starred') {
      baseItems = [
        ...derivedFolders.filter((folder) => folder.starred && !folder.trashedAt),
        ...fileItems.filter((file) => file.meta.starred && !file.meta.trashedAt),
      ]
    } else if (currentLocation.kind === 'trash') {
      baseItems = [
        ...derivedFolders.filter((folder) => folder.trashedAt),
        ...fileItems.filter((file) => file.meta.trashedAt),
      ]
    } else if (currentFolderId) {
      baseItems = [
        ...folderChildren(currentFolderId).filter((folder) => !folder.trashedAt),
        ...fileItems.filter(
          (file) => !file.meta.trashedAt && file.meta.folderId === currentFolderId,
        ),
      ]
    }

    return baseItems
  }, [currentLocation, derivedFolders, fileMeta, files, isVaultActive, searchQuery])

  const detailItem = useMemo(
    () => visibleItems.find((item) => item.id === detailId) || null,
    [detailId, visibleItems],
  )

  const viewerFile = useMemo(
    () => (viewerFileId ? filesById.get(viewerFileId) || null : null),
    [filesById, viewerFileId],
  )

  const metadataFile = useMemo(
    () => (metadataEditorFileId ? filesById.get(metadataEditorFileId) || null : null),
    [filesById, metadataEditorFileId],
  )

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a') {
        event.preventDefault()
        setSelection(visibleItems.map((item) => item.id))
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'x') {
        if (selection.length > 0) {
          event.preventDefault()
          setClipboard({ mode: 'cut', itemIds: selection })
        }
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'c') {
        if (selection.length > 0) {
          event.preventDefault()
          setClipboard({ mode: 'copy', itemIds: selection })
          pushToast({
            title: 'Copied to clipboard',
            description: 'Paste will currently move files within the app workspace.',
            tone: 'info',
          })
        }
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'v') {
        if (clipboard) {
          event.preventDefault()
          moveItems(clipboard.itemIds, currentLocation.kind === 'folder' ? currentLocation.folderId : null)
        }
      }

      if (event.key === 'Delete' && selection.length > 0) {
        event.preventDefault()
        if (currentLocation.kind === 'trash') {
          void handlePermanentDelete(selection)
        } else {
          moveToTrash(selection)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [clipboard, currentLocation, moveItems, moveToTrash, pushToast, selection, setClipboard, setSelection, visibleItems])

  const handlePermanentDelete = async (itemIds: string[]) => {
    const fileIds = itemIds.filter((itemId) => !itemId.startsWith('folder-'))
    const folderIds = itemIds.filter((itemId) => itemId.startsWith('folder-'))

    if (fileIds.length > 0) {
      await onDeleteFiles(fileIds)
    }

    if (folderIds.length > 0 || fileIds.length > 0) {
      purgeItems(itemIds)
    }
  }

  const activateRename = (item: WorkspaceItem) => {
    setRenamingId(item.id)
    setRenameValue(item.kind === 'folder' ? item.name : item.displayName)
    setContextMenu(null)
  }

  const commitRename = () => {
    if (renamingId) {
      renameItem(renamingId, renameValue)
    }
    setRenamingId(null)
    setRenameValue('')
  }

  const handleItemClick = (item: WorkspaceItem, event: MouseEvent<HTMLElement>) => {
    const visibleIds = visibleItems.map((entry) => entry.id)

    if (event.shiftKey && lastSelectedId) {
      const start = visibleIds.indexOf(lastSelectedId)
      const end = visibleIds.indexOf(item.id)
      if (start >= 0 && end >= 0) {
        const range = visibleIds.slice(Math.min(start, end), Math.max(start, end) + 1)
        setSelection(range)
        setDetailId(item.id)
        return
      }
    }

    if (event.metaKey || event.ctrlKey) {
      toggleSelection(item.id)
    } else {
      setSelection([item.id])
    }

    setDetailId(item.id)
    setLastSelectedId(item.id)
  }

  const openItem = (item: WorkspaceItem) => {
    if (item.kind === 'folder') {
      setLocation({ kind: 'folder', folderId: item.id })
      clearSelection()
      return
    }

    openViewer(item.id)
  }

  const handleDropToFolder = (folderId: string, event: DragEvent<HTMLElement>) => {
    event.preventDefault()
    const draggedItemId = event.dataTransfer.getData('text/plain')
    if (!draggedItemId) {
      return
    }
    moveItems([draggedItemId], folderId)
  }

  const renderName = (item: WorkspaceItem) => {
    if (renamingId === item.id) {
      return (
        <form
          onSubmit={(event: FormEvent) => {
            event.preventDefault()
            commitRename()
          }}
        >
          <input
            autoFocus
            className="inline-rename-input"
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
            onBlur={commitRename}
          />
        </form>
      )
    }

    return <span>{item.kind === 'folder' ? item.name : item.displayName}</span>
  }

  const contextMenuElement = contextMenu
    ? createPortal(
        <div
          className="fm-context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          role="menu"
        >
          <button type="button" onClick={() => openItem(visibleItems.find((item) => item.id === contextMenu.id)!)}>Open</button>
          <button type="button" onClick={() => activateRename(visibleItems.find((item) => item.id === contextMenu.id)!)}>Rename</button>
          {(() => {
            const target = visibleItems.find((item) => item.id === contextMenu.id)
            if (!target || target.kind !== 'file') {
              return null
            }

            return (
              <button
                type="button"
                onClick={() => {
                  onShare(target)
                  setContextMenu(null)
                }}
              >
                Share
              </button>
            )
          })()}
          <button
            type="button"
            onClick={() => {
              markStarred(contextMenu.id)
              setContextMenu(null)
            }}
          >
            Star
          </button>
          {isVaultActive && !contextMenu.id.startsWith('folder-') ? (
            <button
              type="button"
              onClick={() => {
                openMetadataEditor(contextMenu.id)
                setContextMenu(null)
              }}
            >
              Edit Metadata
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              if (currentLocation.kind === 'trash') {
                void handlePermanentDelete([contextMenu.id])
              } else {
                moveToTrash([contextMenu.id])
              }
              setContextMenu(null)
            }}
          >
            {currentLocation.kind === 'trash' ? 'Delete Permanently' : 'Move to Trash'}
          </button>
        </div>,
        document.body,
      )
    : null

  return (
    <>
      <div
        className={`fm-workspace ${viewMode === 'detail' ? 'fm-workspace-detail' : ''}`}
        onClick={() => setContextMenu(null)}
      >
        <section className={`fm-stage fm-stage-${viewMode}`}>
          {viewMode === 'list' ? (
            <div className="fm-list">
              <div className="fm-list-header">
                <span>Name</span>
                <span>Type</span>
                <span>Modified</span>
                {isVaultActive ? <span>Embedded</span> : null}
              </div>

              {visibleItems.map((item) => (
                <div
                  key={item.id}
                  className={`fm-list-row ${selection.includes(item.id) ? 'fm-item-selected' : ''}`}
                  onClick={(event) => handleItemClick(item, event)}
                  onDoubleClick={() => openItem(item)}
                  onContextMenu={(event) => {
                    event.preventDefault()
                    setContextMenu({ id: item.id, x: event.clientX, y: event.clientY })
                  }}
                  draggable
                  onDragStart={(event) => {
                    const dragEvent = event as unknown as DragEvent<HTMLElement>
                    dragEvent.dataTransfer.setData('text/plain', item.id)
                  }}
                  onDragOver={(event) => {
                    if (item.kind === 'folder') {
                      event.preventDefault()
                    }
                  }}
                  onDrop={(event) => {
                    if (item.kind !== 'folder') {
                      return
                    }
                    handleDropToFolder(item.id, event)
                  }}
                >
                  <div className="fm-list-name">
                    {item.kind === 'folder' ? <span className="folder-mark">DIR</span> : null}
                    {item.kind === 'file' ? (
                      <motion.div layoutId={`carrier-${item.id}`} className="fm-thumb fm-thumb-list">
                        <CarrierImage fileId={item.id} alt={item.displayName} mimeType={item.carrierMimeType} className="fm-thumb-image" />
                      </motion.div>
                    ) : null}
                    {renderName(item)}
                  </div>
                  <span>{item.kind === 'folder' ? 'Folder' : item.carrierMimeType.replace('image/', '').toUpperCase()}</span>
                  <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                  {isVaultActive ? (
                    <span>
                      {item.kind === 'file'
                        ? isProtectedFile(item)
                          ? `${(item.steganographyMethod || 'lsb').toUpperCase()} | ${item.originalPayloadName}`
                          : 'Visible file'
                        : '--'}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className={`fm-grid ${viewMode === 'detail' ? 'fm-grid-compact' : ''}`}>
              {visibleItems.map((item) => (
                <motion.article
                  key={item.id}
                  className={`fm-card ${selection.includes(item.id) ? 'fm-item-selected' : ''} ${
                    clipboard?.itemIds.includes(item.id) ? 'fm-item-cut' : ''
                  }`}
                  layout
                  onClick={(event) => handleItemClick(item, event)}
                  onDoubleClick={() => openItem(item)}
                  onContextMenu={(event) => {
                    event.preventDefault()
                    setContextMenu({ id: item.id, x: event.clientX, y: event.clientY })
                  }}
                  draggable
                  onDragStart={(event) => {
                    const dragEvent = event as unknown as DragEvent<HTMLElement>
                    dragEvent.dataTransfer.setData('text/plain', item.id)
                  }}
                  onDragOver={(event) => {
                    if (item.kind === 'folder') {
                      event.preventDefault()
                    }
                  }}
                  onDrop={(event) => {
                    if (item.kind !== 'folder') {
                      return
                    }
                    handleDropToFolder(item.id, event)
                    pushToast({
                      title: 'Item moved',
                      description: `Moved into ${item.name}.`,
                      tone: 'success',
                    })
                  }}
                >
                  {item.kind === 'folder' ? (
                    <div className="fm-folder-card">
                      <span className="fm-folder-icon">DIR</span>
                      <div className="fm-card-copy">
                        <strong>{renderName(item)}</strong>
                        <span>{item.itemCount} items</span>
                      </div>
                    </div>
                  ) : (
                    <>
                      <motion.div layoutId={`carrier-${item.id}`} className="fm-card-media">
                        <CarrierImage fileId={item.id} alt={item.displayName} mimeType={item.carrierMimeType} className="fm-card-image" />
                      </motion.div>
                      <div className="fm-card-copy">
                        <strong>{renderName(item)}</strong>
                        <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                        {isVaultActive && isProtectedFile(item) ? (
                          <span className="method-badge">
                            {(item.steganographyMethod || 'lsb').toUpperCase()}
                          </span>
                        ) : null}
                      </div>
                    </>
                  )}
                </motion.article>
              ))}
            </div>
          )}
        </section>

        <AnimatePresence>
          {viewMode === 'detail' || detailItem ? (
            <motion.aside
              className="fm-detail-panel"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
            >
              {detailItem ? (
                <>
                  {isFileItem(detailItem) ? (
                    <>
                      <motion.div layoutId={`carrier-${detailItem.id}`} className="fm-detail-media">
                        <CarrierImage fileId={detailItem.id} alt={detailItem.displayName} mimeType={detailItem.carrierMimeType} className="fm-detail-image" />
                      </motion.div>
                      <h3>{detailItem.displayName}</h3>
                      <p>{detailItem.carrierMimeType} | {(detailItem.carrierSize / (1024 * 1024)).toFixed(1)} MB</p>
                      {isVaultActive ? (
                        <div className="fm-detail-meta">
                          {isProtectedFile(detailItem) ? (
                            <>
                              <span>Payload {detailItem.originalPayloadName}</span>
                              <span>Method {(detailItem.steganographyMethod || 'lsb').toUpperCase()}</span>
                              <span>Capacity {detailItem.capacityUsedPercent?.toFixed(1) || '0.0'}%</span>
                            </>
                          ) : (
                            <>
                              <span>Standard visible file</span>
                              <span>No embedded payload</span>
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="fm-detail-meta">
                          <span>Visible file {detailItem.carrierOriginalName}</span>
                          <span>Added {new Date(detailItem.createdAt).toLocaleDateString()}</span>
                        </div>
                      )}
                      <div className="fm-detail-actions">
                        {isVaultActive && isProtectedFile(detailItem) ? (
                          <>
                            <button type="button" className="button-primary" onClick={() => onDecrypt(detailItem)}>
                              Decrypt
                            </button>
                            <button
                              type="button"
                              className="button-secondary"
                              onClick={() => openMetadataEditor(detailItem.id)}
                            >
                              Edit Metadata
                            </button>
                          </>
                        ) : null}
                        <button
                          type="button"
                          className={isVaultActive && isProtectedFile(detailItem) ? 'button-secondary' : 'button-primary'}
                          onClick={() => onShare(detailItem)}
                        >
                          Share
                        </button>
                        <button
                          type="button"
                          className={isVaultActive ? 'button-ghost' : 'button-secondary'}
                          onClick={() => openViewer(detailItem.id)}
                        >
                          Open Viewer
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="fm-detail-folder-mark">DIR</div>
                      <h3>{detailItem.name}</h3>
                      <p>{detailItem.itemCount} items</p>
                      <div className="fm-detail-actions">
                        <button type="button" className="button-secondary" onClick={() => activateRename(detailItem)}>
                          Rename
                        </button>
                        <button
                          type="button"
                          className="button-ghost"
                          onClick={() => setLocation({ kind: 'folder', folderId: detailItem.id })}
                        >
                          Open Folder
                        </button>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <p className="fm-detail-empty">Select a file or folder to inspect it.</p>
              )}
            </motion.aside>
          ) : null}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {selection.length > 0 ? (
          <motion.div
            className="fm-selection-bar"
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
          >
            <span>{selection.length} selected</span>
            {currentLocation.kind === 'trash' ? (
              <button type="button" className="button-ghost" onClick={() => restoreFromTrash(selection)}>
                Restore
              </button>
            ) : null}
            <button type="button" className="button-ghost" onClick={() => setClipboard({ mode: 'cut', itemIds: selection })}>
              Cut
            </button>
            <button type="button" className="button-ghost" onClick={() => setClipboard({ mode: 'copy', itemIds: selection })}>
              Copy
            </button>
            {selection.length === 1 && !selection[0].startsWith('folder-') ? (
              <button
                type="button"
                className="button-ghost"
                onClick={() => {
                  const selectedFile = filesById.get(selection[0])
                  if (selectedFile) {
                    onShare(selectedFile)
                  }
                }}
              >
                Share
              </button>
            ) : null}
            {currentLocation.kind === 'trash' ? (
              <button type="button" className="button-ghost" onClick={() => void handlePermanentDelete(selection)}>
                Delete
              </button>
            ) : (
              <button type="button" className="button-ghost" onClick={() => moveToTrash(selection)}>
                Trash
              </button>
            )}
            <button type="button" className="button-ghost" onClick={clearSelection}>
              Clear
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {contextMenuElement}

      <FileViewer
        file={viewerFile}
        meta={viewerFile ? fileMeta[viewerFile.id] : undefined}
        isVaultActive={isVaultActive}
        onClose={closeViewer}
        onDecrypt={onDecrypt}
        onShare={onShare}
        onOpenMetadata={openMetadataEditor}
        onDelete={(fileId) => {
          if (currentLocation.kind === 'trash') {
            void handlePermanentDelete([fileId])
          } else {
            moveToTrash([fileId])
          }
        }}
      />

      <MetadataEditor
        file={metadataFile}
        meta={metadataFile ? fileMeta[metadataFile.id] : undefined}
        open={Boolean(metadataFile)}
        onClose={closeMetadataEditor}
        onSave={(updates) => {
          if (metadataFile) {
            updateMetadata(metadataFile.id, updates)
            pushToast({
              title: 'Metadata saved',
              description: 'Display metadata was updated locally.',
              tone: 'success',
            })
          }
        }}
      />
    </>
  )
}

import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFileStore } from '@/store/fileStore'
import { useUiStore } from '@/store/uiStore'

export default function Toolbar({
  onDeleteSelection,
}: {
  onDeleteSelection: () => void
}) {
  const navigate = useNavigate()
  const selection = useFileStore((state) => state.selection)
  const currentLocation = useFileStore((state) => state.currentLocation)
  const clipboard = useFileStore((state) => state.clipboard)
  const createFolder = useFileStore((state) => state.createFolder)
  const setClipboard = useFileStore((state) => state.setClipboard)
  const moveItems = useFileStore((state) => state.moveItems)
  const moveToTrash = useFileStore((state) => state.moveToTrash)
  const restoreFromTrash = useFileStore((state) => state.restoreFromTrash)
  const clearSelection = useFileStore((state) => state.clearSelection)
  const setPendingUploadTarget = useFileStore((state) => state.setPendingUploadTarget)
  const viewMode = useUiStore((state) => state.viewMode)
  const setViewMode = useUiStore((state) => state.setViewMode)

  const activeFolderId = currentLocation.kind === 'folder' ? currentLocation.folderId : null
  const hasSelection = selection.length > 0
  const pasteDisabled = !clipboard
  const isTrashView = currentLocation.kind === 'trash'

  const title = useMemo(() => {
    if (currentLocation.kind === 'folder') {
      return 'Folder'
    }

    return currentLocation.kind[0].toUpperCase() + currentLocation.kind.slice(1)
  }, [currentLocation])

  return (
    <div className="fm-toolbar">
      <div className="fm-toolbar-group fm-toolbar-group-leading">
        <span className="fm-toolbar-label">{title}</span>
        <button
          type="button"
          className="toolbar-button toolbar-button-primary-soft"
          onClick={() => {
            setPendingUploadTarget(activeFolderId)
            navigate('/upload')
          }}
        >
          Add File
        </button>
        <button
          type="button"
          className="toolbar-button"
          onClick={() => createFolder(`New Folder ${Date.now().toString().slice(-4)}`, activeFolderId)}
        >
          New Folder
        </button>
      </div>

      <div className="fm-toolbar-group fm-toolbar-group-actions">
        {isTrashView ? (
          <button
            type="button"
            className="toolbar-button"
            onClick={() => restoreFromTrash(selection)}
            disabled={!hasSelection}
          >
            Restore
          </button>
        ) : null}
        <button
          type="button"
          className={`toolbar-button ${clipboard?.mode === 'cut' ? 'toolbar-button-active' : ''}`}
          onClick={() => setClipboard(hasSelection ? { mode: 'cut', itemIds: selection } : null)}
          disabled={!hasSelection}
        >
          Cut
        </button>
        <button
          type="button"
          className={`toolbar-button ${clipboard?.mode === 'copy' ? 'toolbar-button-active' : ''}`}
          onClick={() => setClipboard(hasSelection ? { mode: 'copy', itemIds: selection } : null)}
          disabled={!hasSelection}
        >
          Copy
        </button>
        <button
          type="button"
          className="toolbar-button"
          onClick={() => {
            if (!clipboard) {
              return
            }
            moveItems(clipboard.itemIds, activeFolderId)
            clearSelection()
          }}
          disabled={pasteDisabled}
        >
          Paste
        </button>
        <button
          type="button"
          className="toolbar-button toolbar-button-danger"
          onClick={() => {
            if (!hasSelection) {
              return
            }

            if (isTrashView) {
              onDeleteSelection()
              return
            }

            moveToTrash(selection)
          }}
          disabled={!hasSelection}
        >
          {isTrashView ? 'Delete' : 'Trash'}
        </button>
      </div>

      <div className="fm-toolbar-group fm-toolbar-group-right">
        {(['grid', 'list', 'detail'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            className={`toolbar-toggle ${viewMode === mode ? 'toolbar-toggle-active' : ''}`}
            onClick={() => setViewMode(mode)}
          >
            {mode}
          </button>
        ))}
      </div>
    </div>
  )
}

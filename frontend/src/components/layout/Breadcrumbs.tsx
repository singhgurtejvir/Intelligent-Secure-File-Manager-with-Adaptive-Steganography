import { useMemo } from 'react'
import { useFileStore } from '@/store/fileStore'

export default function Breadcrumbs() {
  const folders = useFileStore((state) => state.folders)
  const currentLocation = useFileStore((state) => state.currentLocation)
  const setLocation = useFileStore((state) => state.setLocation)

  const segments = useMemo(() => {
    if (currentLocation.kind !== 'folder') {
      return [{ id: currentLocation.kind, label: currentLocation.kind[0].toUpperCase() + currentLocation.kind.slice(1) }]
    }

    const folderMap = new Map(folders.map((folder) => [folder.id, folder]))
    const chain: Array<{ id: string; label: string }> = []
    let cursor = folderMap.get(currentLocation.folderId)

    while (cursor) {
      chain.unshift({ id: cursor.id, label: cursor.name })
      cursor = cursor.parentId ? folderMap.get(cursor.parentId) : undefined
    }

    return [{ id: 'home', label: 'Home' }, ...chain]
  }, [currentLocation, folders])

  return (
    <div className="fm-breadcrumbs">
      {segments.map((segment, index) => {
        const isLast = index === segments.length - 1
        return (
          <span key={segment.id} className="breadcrumb-segment-wrap">
            <button
              type="button"
              className={`breadcrumb-segment ${isLast ? 'breadcrumb-current' : ''}`}
              disabled={isLast}
              onClick={() => {
                if (segment.id === 'home') {
                  setLocation({ kind: 'home' })
                } else {
                  setLocation({ kind: 'folder', folderId: segment.id })
                }
              }}
            >
              {segment.label}
            </button>
            {!isLast ? <span className="breadcrumb-separator">/</span> : null}
          </span>
        )
      })}
    </div>
  )
}

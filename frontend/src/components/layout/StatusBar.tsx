import { useMemo } from 'react'
import { useFileStore } from '@/store/fileStore'

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`
  }

  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unitIndex = 0

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  return `${value.toFixed(1)} ${units[unitIndex]}`
}

export default function StatusBar({
  visibleCount,
}: {
  visibleCount: number
}) {
  const files = useFileStore((state) => state.files)
  const selection = useFileStore((state) => state.selection)
  const currentLocation = useFileStore((state) => state.currentLocation)

  const storageUsed = useMemo(
    () => files.reduce((total, file) => total + file.carrierSize, 0),
    [files],
  )
  const quota = 5 * 1024 * 1024 * 1024
  const quotaPercent = Math.min((storageUsed / quota) * 100, 100)

  return (
    <div className="fm-statusbar">
      <span>{visibleCount} items</span>
      <span>{selection.length} selected</span>
      <span className="fm-status-location">
        {currentLocation.kind === 'folder' ? 'Folder view' : `${currentLocation.kind} view`}
      </span>
      <div className="fm-status-usage">
        <span>{formatBytes(storageUsed)} used</span>
        <div className="fm-status-pill">
          <div className="fm-status-pill-fill" style={{ width: `${quotaPercent}%` }} />
        </div>
      </div>
    </div>
  )
}

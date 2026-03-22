import { useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useFileStore } from '@/store/fileStore'
import { useUiStore } from '@/store/uiStore'
import { useVaultStore } from '@/store/vaultStore'

const staticNav: Array<{ key: 'home' | 'recent' | 'starred' | 'trash'; label: string; icon: string }> = [
  { key: 'home', label: 'Home', icon: 'H' },
  { key: 'recent', label: 'Recent', icon: 'R' },
  { key: 'starred', label: 'Starred', icon: 'S' },
  { key: 'trash', label: 'Trash', icon: 'T' },
]

export default function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const folders = useFileStore((state) => state.folders)
  const currentLocation = useFileStore((state) => state.currentLocation)
  const setLocation = useFileStore((state) => state.setLocation)
  const createFolder = useFileStore((state) => state.createFolder)
  const sidebarCollapsed = useUiStore((state) => state.sidebarCollapsed)
  const toggleSidebar = useUiStore((state) => state.toggleSidebar)
  const isVaultActive = useVaultStore((state) => state.isVaultActive)

  const rootFolders = useMemo(
    () => folders.filter((folder) => !folder.parentId && !folder.trashedAt),
    [folders],
  )

  const folderTree = useMemo(
    () =>
      rootFolders.map((folder) => ({
        ...folder,
        children: folders.filter((child) => child.parentId === folder.id && !child.trashedAt),
      })),
    [folders, rootFolders],
  )

  const goToManagerLocation = (nextLocation: Parameters<typeof setLocation>[0]) => {
    setLocation(nextLocation)
    if (location.pathname !== '/') {
      navigate('/')
    }
  }

  return (
    <aside className={`shell-sidebar ${sidebarCollapsed ? 'shell-sidebar-collapsed' : ''}`}>
      <div className="sidebar-head">
        <button type="button" className="sidebar-collapse" onClick={toggleSidebar} aria-label="Toggle sidebar">
          {sidebarCollapsed ? '>>' : '<<'}
        </button>
      </div>

      <div className="sidebar-section">
        {staticNav.map((entry) => {
          const active = currentLocation.kind === entry.key
          return (
            <button
              key={entry.key}
              type="button"
              className={`sidebar-item ${active ? 'sidebar-item-active' : ''}`}
              onClick={() => goToManagerLocation({ kind: entry.key })}
              title={entry.label}
            >
              <span className="sidebar-item-icon">{entry.icon}</span>
              {!sidebarCollapsed ? <span>{entry.label}</span> : null}
            </button>
          )
        })}
      </div>

      <div className="sidebar-section sidebar-folder-section">
        {!sidebarCollapsed ? (
          <div className="sidebar-section-header">
            <span>My Folders</span>
            <button
              type="button"
              className="sidebar-mini-action"
              onClick={() => {
                createFolder(`New Folder ${rootFolders.length + 1}`)
              }}
            >
              +
            </button>
          </div>
        ) : null}

        <div className="sidebar-tree">
          {folderTree.map((folder) => (
            <div key={folder.id} className="sidebar-tree-group">
              <button
                type="button"
                className={`sidebar-item ${
                  currentLocation.kind === 'folder' && currentLocation.folderId === folder.id
                    ? 'sidebar-item-active'
                    : ''
                }`}
                onClick={() => goToManagerLocation({ kind: 'folder', folderId: folder.id })}
                title={folder.name}
              >
                <span className="sidebar-item-icon">{isVaultActive ? 'V' : 'F'}</span>
                {!sidebarCollapsed ? <span>{folder.name}</span> : null}
              </button>

              {!sidebarCollapsed
                ? folder.children.map((child) => (
                    <button
                      key={child.id}
                      type="button"
                      className={`sidebar-item sidebar-item-child ${
                        currentLocation.kind === 'folder' && currentLocation.folderId === child.id
                          ? 'sidebar-item-active'
                          : ''
                      }`}
                      onClick={() => goToManagerLocation({ kind: 'folder', folderId: child.id })}
                    >
                      <span className="sidebar-item-icon">-</span>
                      <span>{child.name}</span>
                    </button>
                  ))
                : null}
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}

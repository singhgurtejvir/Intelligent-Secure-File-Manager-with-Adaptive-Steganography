import { NavLink, useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { useAuthStore } from '@/store/authStore'
import { useFileStore } from '@/store/fileStore'
import { useVaultTrigger } from '@/hooks/useVaultTrigger'

export default function Navbar() {
  const navigate = useNavigate()
  const reduceMotion = useReducedMotion()
  const { email, logout } = useAuthStore()
  const { isVaultActive, startHold, cancelHold } = useVaultTrigger()
  const files = useFileStore((state) => state.files)
  const fileMeta = useFileStore((state) => state.fileMeta)
  const folders = useFileStore((state) => state.folders)
  const searchQuery = useFileStore((state) => state.searchQuery)
  const setSearchQuery = useFileStore((state) => state.setSearchQuery)
  const setLocation = useFileStore((state) => state.setLocation)
  const setDetailId = useFileStore((state) => state.setDetailId)

  const searchResults = searchQuery.trim()
    ? [
        ...folders
          .filter((folder) => folder.name.toLowerCase().includes(searchQuery.toLowerCase()))
          .slice(0, 3)
          .map((folder) => ({
            id: folder.id,
            kind: 'folder' as const,
            label: folder.name,
            path: 'Folder',
          })),
        ...files
          .filter((file) =>
            [
              isVaultActive ? file.name : fileMeta[file.id]?.aliasName || file.carrierOriginalName,
              file.carrierOriginalName,
              ...(isVaultActive ? [file.originalPayloadName] : []),
            ]
              .join(' ')
              .toLowerCase()
              .includes(searchQuery.toLowerCase()),
          )
          .slice(0, 5)
          .map((file) => ({
            id: file.id,
            kind: 'file' as const,
            label: fileMeta[file.id]?.aliasName || file.carrierOriginalName,
            path: fileMeta[file.id]?.folderId ? 'Folder item' : 'Home',
          })),
      ]
    : []

  return (
    <>
      <motion.header
        className="navbar"
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -12 }}
        animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      >
        <div className="navbar-inner">
          <button
            type="button"
            className={`brand-button ${isVaultActive ? 'brand-button-active' : ''}`}
            onMouseDown={startHold}
            onMouseUp={cancelHold}
            onMouseLeave={cancelHold}
            onTouchStart={startHold}
            onTouchEnd={cancelHold}
          >
            <span className={`brand-mark ${isVaultActive ? 'brand-mark-vault' : ''}`}>
              {isVaultActive ? 'Private Vault' : 'Your Files'}
            </span>
          </button>

          <nav className="navbar-links">
            <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>
              Files
            </NavLink>
            <NavLink
              to="/upload"
              className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}
            >
              Upload
            </NavLink>
            <NavLink
              to="/settings"
              className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}
            >
              Settings
            </NavLink>
            <NavLink
              to="/shared"
              className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}
            >
              Shared
            </NavLink>
          </nav>

          <div className="navbar-search">
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="navbar-search-input"
              placeholder={isVaultActive ? 'Search files, folders, payloads' : 'Search files and folders'}
            />

            {searchResults.length > 0 ? (
              <div className="navbar-search-results">
                {searchResults.map((result) => (
                  <button
                    key={`${result.kind}-${result.id}`}
                    type="button"
                    className="navbar-search-result"
                    onClick={() => {
                      if (result.kind === 'folder') {
                        setLocation({ kind: 'folder', folderId: result.id })
                      } else {
                        const folderId = fileMeta[result.id]?.folderId
                        setLocation(folderId ? { kind: 'folder', folderId } : { kind: 'home' })
                        setDetailId(result.id)
                      }
                      setSearchQuery('')
                      navigate('/')
                    }}
                  >
                    <strong>{result.label}</strong>
                    <span>{result.path}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="navbar-meta">
            <span className="navbar-email">{email}</span>
            <span className={`vault-dot ${isVaultActive ? 'vault-dot-active' : ''}`} />
            <button
              type="button"
              className="button-ghost"
              onClick={() => {
                logout()
                navigate('/login')
              }}
            >
              Logout
            </button>
          </div>
        </div>
      </motion.header>

      <nav className="mobile-tabbar">
        <NavLink to="/" className={({ isActive }) => `mobile-tab ${isActive ? 'mobile-tab-active' : ''}`}>
          Files
        </NavLink>
        <NavLink
          to="/upload"
          className={({ isActive }) => `mobile-tab ${isActive ? 'mobile-tab-active' : ''}`}
        >
          Upload
        </NavLink>
        <NavLink
          to="/settings"
          className={({ isActive }) => `mobile-tab ${isActive ? 'mobile-tab-active' : ''}`}
        >
          Settings
        </NavLink>
        <NavLink
          to="/shared"
          className={({ isActive }) => `mobile-tab ${isActive ? 'mobile-tab-active' : ''}`}
        >
          Shared
        </NavLink>
      </nav>
    </>
  )
}

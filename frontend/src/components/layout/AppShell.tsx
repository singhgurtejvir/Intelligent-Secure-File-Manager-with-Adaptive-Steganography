import { Outlet, useLocation } from 'react-router-dom'
import Navbar from '@/components/Navbar'
import Sidebar from '@/components/layout/Sidebar'
import { useVaultStore } from '@/store/vaultStore'

export default function AppShell() {
  const location = useLocation()
  const isGalleryRoute = location.pathname === '/'
  const isVaultActive = useVaultStore((state) => state.isVaultActive)

  return (
    <div className={`page-shell app-shell ${isVaultActive ? 'app-shell-vault' : 'app-shell-gallery'}`}>
      <Navbar />
      <div className="shell-body">
        <Sidebar />
        <main className={`shell-main ${isGalleryRoute ? 'shell-main-gallery' : ''}`}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}

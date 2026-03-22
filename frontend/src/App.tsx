import { BrowserRouter as Router, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import Gallery from '@/pages/Gallery'
import Upload from '@/pages/Upload'
import Settings from '@/pages/Settings'
import Login from '@/pages/Login'
import Register from '@/pages/Register'
import AppShell from '@/components/layout/AppShell'
import PageTransition from '@/components/PageTransition'
import Toast from '@/components/Toast'
import { useAuthStore } from '@/store/authStore'
import { useVaultStore } from '@/store/vaultStore'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

function RoutedApp() {
  const location = useLocation()
  const isVaultActive = useVaultStore((state) => state.isVaultActive)

  return (
    <div
      className={`app-frame ${isVaultActive ? 'app-theme-vault' : 'app-theme-gallery'} ${
        location.pathname === '/login' || location.pathname === '/register' ? 'app-frame-auth' : ''
      }`}
    >
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          >
            <Route
              path="/"
              element={
                <PageTransition>
                  <Gallery />
                </PageTransition>
              }
            />
            <Route
              path="/upload"
              element={
                <PageTransition>
                  <Upload />
                </PageTransition>
              }
            />
            <Route
              path="/settings"
              element={
                <PageTransition>
                  <Settings />
                </PageTransition>
              }
            />
          </Route>
        </Routes>
      </AnimatePresence>
      <Toast />
    </div>
  )
}

export default function App() {
  return (
    <Router>
      <RoutedApp />
    </Router>
  )
}

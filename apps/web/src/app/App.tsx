import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { TopNavbar } from './TopNavbar'
import { Notice } from '@freecodexyz/ui'
import { GateView } from '../features/auth/GateView'
import { useAuthSession } from '../features/auth/useAuthSession'
import { ErrorBoundary } from './ErrorBoundary'
import '../App.css'

const Registry = lazy(() => import('../features/registry/Registry').then(({ Registry }) => ({ default: Registry })))
const Marketplace = lazy(() => import('../features/marketplace/Marketplace').then(({ Marketplace }) => ({ default: Marketplace })))

type AccessState = 'locked' | 'unlocked'

function ProtectedRoute({ accessState, children }: { accessState: AccessState; children: ReactNode }) {
  if (accessState === 'locked') return <GateView />
  return <>{children}</>
}

function RouteLoading({ label }: { label: string }) {
  return (
    <main className="route-loading" data-accent="emerald">
      <Notice>{label}</Notice>
    </main>
  )
}

function App() {
  const { isSignedIn, isSessionLoading } = useAuthSession()
  const accessState: AccessState = isSessionLoading || !isSignedIn ? 'locked' : 'unlocked'

  return (
    <>
      <TopNavbar registryAccess={accessState} />
      <Routes>
        <Route path="/" element={<Navigate to="/registry" replace />} />
        <Route
          path="/registry"
          element={(
            <ErrorBoundary label="Registry route" resetKey={`registry:${accessState}`}>
              <ProtectedRoute accessState={accessState}>
                <Suspense fallback={<RouteLoading label="Loading registry..." />}>
                  <Registry />
                </Suspense>
              </ProtectedRoute>
            </ErrorBoundary>
          )}
        />
        <Route
          path="/marketplace"
          element={(
            <ErrorBoundary label="Marketplace route" resetKey={`marketplace:${accessState}`}>
              <ProtectedRoute accessState={accessState}>
                <Suspense fallback={<RouteLoading label="Loading marketplace..." />}>
                  <Marketplace />
                </Suspense>
              </ProtectedRoute>
            </ErrorBoundary>
          )}
        />
        <Route path="*" element={<Navigate to="/registry" replace />} />
      </Routes>
    </>
  )
}

export default App

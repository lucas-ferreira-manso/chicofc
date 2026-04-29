import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from './lib/firebase'
import { useAuthStore } from './store/authStore'
import BottomNav from './components/layout/BottomNav'
import LoginPage from './pages/LoginPage'
import GamesPage from './pages/GamesPage'
import GameDetailPage from './pages/GameDetailPage'
import NewGamePage from './pages/NewGamePage'
import StatsPage from './pages/StatsPage'
import CaixinhaPage from './pages/CaixinhaPage'
import ProfilePage from './pages/ProfilePage'
import AdminPage from './pages/AdminPage'

export default function App() {
  const { user, loading, setLoading, fetchProfile } = useAuthStore()

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        await fetchProfile(firebaseUser.uid, firebaseUser.email ?? '')
      } else {
        setLoading(false)
      }
    })
    return unsub
  }, [])

  if (loading) return (
    <div className="flex-1 flex items-center justify-center min-h-dvh" style={{ background: 'var(--bg)' }}>
      <div className="text-5xl animate-spin">⚽</div>
    </div>
  )

  if (!user) return <LoginPage />

  return (
    <div className="flex flex-col flex-1">
      <main className="flex-1 overflow-y-auto">
        <Routes>
          <Route path="/" element={<Navigate to="/games" replace />} />
          <Route path="/games" element={<GamesPage />} />
          <Route path="/games/new" element={<NewGamePage />} />
          <Route path="/games/:id" element={<GameDetailPage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/caixinha" element={<CaixinhaPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="*" element={<Navigate to="/games" replace />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  )
}

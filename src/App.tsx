import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from './lib/firebase'
import { useAuthStore } from './store/authStore'
import { requestNotificationPermission, listenForegroundMessages } from './lib/notifications'
import BottomNav from './components/layout/BottomNav'
import LoginPage from './pages/LoginPage'
import GamesPage from './pages/GamesPage'
import StatsPage from './pages/StatsPage'
import CaixinhaPage from './pages/CaixinhaPage'
import ProfilePage from './pages/ProfilePage'
import AdminPage from './pages/AdminPage'
import AdminPlayersPage from './pages/AdminPlayersPage'
import AdminPlayerDetailPage from './pages/AdminPlayerDetailPage'
import EscalacaoPage from './pages/EscalacaoPage'
import NotificacoesAdminPage from './pages/NotificacoesAdminPage'
import PresencaPage from './pages/PresencaPage'
import RankingVotacaoPage from './pages/RankingVotacaoPage'
import ExportarRelatorioPage from './pages/ExportarRelatorioPage'
import TermsSheet, { hasAcceptedTermsLocally } from './components/TermsSheet'

export default function App() {
  const { user, loading, setLoading, fetchProfile } = useAuthStore()
  const [showTerms, setShowTerms] = useState(false)

  useEffect(() => {
    if (!user) return
    // Considera aceito se: campo no Firestore OU aceite gravado no localStorage
    const accepted = user.termsAccepted || hasAcceptedTermsLocally(user.id)
    if (!accepted) setShowTerms(true)
  }, [user?.id])

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

  // Pede permissão de notificação após login
  useEffect(() => {
    if (user?.id) {
      requestNotificationPermission(user.id)
      listenForegroundMessages()
    }
  }, [user?.id])

  if (loading) return (
    <div className="flex-1 flex items-center justify-center min-h-dvh" style={{ background: 'var(--color-bg)' }}>
      <div className="text-5xl animate-spin">⚽</div>
    </div>
  )

  if (!user) return <LoginPage />

  const location = useLocation()
  const hideNav = location.pathname === '/escalacao'
    || location.pathname === '/admin/notificacoes'
    || location.pathname.startsWith('/admin/jogadores/')
    || location.pathname.startsWith('/admin/jogador/')
    || location.pathname === '/caixinha/exportar'

  return (
    <div className="flex flex-col flex-1">
      <main className="flex-1 overflow-y-auto">
        <Routes>
          <Route path="/" element={<Navigate to="/games" replace />} />
          <Route path="/games" element={<GamesPage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/caixinha" element={<CaixinhaPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/admin/jogadores/:type" element={<AdminPlayersPage />} />
          <Route path="/admin/jogador/:id" element={<AdminPlayerDetailPage />} />
          <Route path="/escalacao" element={<EscalacaoPage />} />
          <Route path="/admin/notificacoes" element={<NotificacoesAdminPage />} />
          <Route path="/presenca" element={<PresencaPage />} />
          <Route path="/ranking-votacao" element={<RankingVotacaoPage />} />
          <Route path="/caixinha/exportar" element={<ExportarRelatorioPage />} />
          <Route path="*" element={<Navigate to="/games" replace />} />
        </Routes>
      </main>
      {!hideNav && <BottomNav />}
      {showTerms && <TermsSheet onAccept={() => setShowTerms(false)} />}
    </div>
  )
}

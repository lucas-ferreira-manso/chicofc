import { useState } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuthStore } from '../store/authStore'
import TermsContent from './TermsContent'

// Incrementar este número força TODOS os jogadores a re-aceitarem os termos
export const TERMS_VERSION = 2

interface Props {
  onAccept: () => void
}

function localKey(userId: string) {
  return `terms_v${TERMS_VERSION}_accepted_${userId}`
}

export function hasAcceptedTermsLocally(userId: string): boolean {
  try { return localStorage.getItem(localKey(userId)) === '1' } catch { return false }
}

export function needsTermsAcceptance(user: { id: string; termsAccepted?: boolean; termsVersion?: number }): boolean {
  if (!user.termsAccepted) return true
  if ((user.termsVersion ?? 1) < TERMS_VERSION) return true
  return !hasAcceptedTermsLocally(user.id)
}

export default function TermsSheet({ onAccept }: Props) {
  const user = useAuthStore(s => s.user)
  const setUser = useAuthStore(s => s.setUser)
  const [loading, setLoading] = useState(false)

  const handleAccept = async () => {
    if (!user) return
    setLoading(true)

    // 1. Salva no localStorage imediatamente
    try { localStorage.setItem(localKey(user.id), '1') } catch { /* ignore */ }

    // 2. Persiste no Firestore com a versão atual
    try {
      await updateDoc(doc(db, 'players', user.id), {
        termsAccepted: true,
        termsVersion: TERMS_VERSION
      })
    } catch {
      console.warn('[TermsSheet] Não foi possível salvar no Firestore.')
    }

    // 3. Atualiza store e libera o app
    setUser({ ...user, termsAccepted: true, termsVersion: TERMS_VERSION } as any)
    setLoading(false)
    onAccept()
  }

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 80 }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 90,
        background: 'var(--color-bg)', borderRadius: '24px 24px 0 0',
        padding: '28px 24px 40px', display: 'flex', flexDirection: 'column', gap: 20,
        maxHeight: '85dvh', overflowY: 'auto'
      }}>
        <TermsContent />
        <button
          onClick={handleAccept}
          disabled={loading}
          style={{
            width: '100%', padding: '16px', borderRadius: 9999,
            background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-fg)',
            fontFamily: 'var(--font-primary)', fontWeight: 600,
            fontSize: 'var(--font-size-16)', border: 'none',
            cursor: loading ? 'default' : 'pointer',
            opacity: loading ? 0.6 : 1
          }}>
          {loading ? 'Salvando...' : 'Li e aceito os termos ✅'}
        </button>
      </div>
    </>
  )
}

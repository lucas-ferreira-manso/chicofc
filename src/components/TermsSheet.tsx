import { useState } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuthStore } from '../store/authStore'
import TermsContent from './TermsContent'

interface Props {
  onAccept: () => void
}

export default function TermsSheet({ onAccept }: Props) {
  const user = useAuthStore(s => s.user)
  const setUser = useAuthStore(s => s.setUser)
  const [loading, setLoading] = useState(false)

  const handleAccept = async () => {
    if (!user) return
    setLoading(true)
    try {
      await updateDoc(doc(db, 'players', user.id), { termsAccepted: true })
      setUser({ ...user, termsAccepted: true })
      onAccept()
    } catch {
      setLoading(false)
    }
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

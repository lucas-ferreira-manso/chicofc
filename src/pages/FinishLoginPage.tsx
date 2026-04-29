import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

export default function FinishLoginPage() {
  const [status, setStatus] = useState<'loading' | 'error'>('loading')
  const completeSignIn = useAuthStore(s => s.completeSignIn)
  const navigate = useNavigate()

  useEffect(() => {
    completeSignIn().then(ok => {
      if (ok) navigate('/', { replace: true })
      else setStatus('error')
    })
  }, [])

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6" style={{ background: 'var(--bg)' }}>
      {status === 'loading' ? (
        <>
          <div className="text-5xl animate-spin mb-4">⚽</div>
          <p className="text-white font-medium">Entrando...</p>
        </>
      ) : (
        <>
          <div className="text-5xl mb-4">❌</div>
          <p className="text-white font-medium">Link inválido ou expirado</p>
          <button onClick={() => navigate('/')} className="mt-4 underline text-sm" style={{ color: 'var(--text-muted)' }}>
            Voltar ao login
          </button>
        </>
      )}
    </div>
  )
}

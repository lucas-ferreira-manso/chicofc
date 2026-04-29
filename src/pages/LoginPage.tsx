import { useState } from 'react'
import { toast } from 'sonner'
import { useAuthStore } from '../store/authStore'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const signIn = useAuthStore(s => s.signIn)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await signIn(email.trim().toLowerCase(), password)
    setLoading(false)
    if (error) toast.error(error)
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6" style={{ background: 'var(--bg)' }}>
      <div className="mb-10 text-center">
        <img
          src="/logo-time.png"
          alt="Logo do time"
          width={56}
          height={56}
          className="mx-auto mb-3"
        />
        <h1 className="text-3xl font-bold text-white">Chico FC</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>O app da nossa pelada</p>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <div>
          <label className="block text-sm mb-2" style={{ color: 'var(--text-muted)' }}>Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="seu@email.com"
            required
            autoComplete="email"
            className="w-full px-4 py-3 rounded-xl text-white outline-none"
            style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}
          />
        </div>
        <div>
          <label className="block text-sm mb-2" style={{ color: 'var(--text-muted)' }}>Senha</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            autoComplete="current-password"
            className="w-full px-4 py-3 rounded-xl text-white outline-none"
            style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl font-semibold text-white transition-all active:scale-95 disabled:opacity-50"
          style={{ background: 'var(--green)' }}
        >
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}

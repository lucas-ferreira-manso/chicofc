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

  const filled = email.length > 0 && password.length > 0

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: 'var(--color-bg)' }}>
      {/* Logo area */}
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <img src="/logo.png" alt="Chico FC" width={72} height={72} />
          <p className="text-sm font-medium" style={{ color: 'var(--color-fg-secondary)', fontFamily: 'var(--font-primary)' }}>
            O app da nossa pelada
          </p>
        </div>
      </div>

      {/* Form area */}
      <div className="px-6 pb-12 flex flex-col gap-6">
        <div className="flex flex-col gap-2 items-center">
          <h1 className="font-bold" style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-32)' }}>
            Entrar
          </h1>
          <p className="text-center" style={{ color: 'var(--color-fg-secondary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-18)' }}>
            Digite seu email e a senha
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="flex flex-col gap-4">
            <div style={{ background: 'var(--color-surface-primary)', borderRadius: 'var(--radius-pill)' }}
              className="flex items-center px-6 py-4">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Email"
                required
                autoComplete="email"
                className="w-full bg-transparent outline-none font-medium"
                style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)' }}
              />
            </div>
            <div style={{ background: 'var(--color-surface-primary)', borderRadius: 'var(--radius-pill)' }}
              className="flex items-center px-6 py-4">
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Senha"
                required
                autoComplete="current-password"
                className="w-full bg-transparent outline-none font-medium"
                style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)' }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !filled}
            className="w-full py-4 font-medium transition-all active:scale-95"
            style={{
              background: filled && !loading ? 'var(--color-surface-accent)' : 'var(--color-surface-secondary)',
              color: filled && !loading ? 'var(--color-fg-tertiary)' : 'var(--color-fg-secondary)',
              borderRadius: 'var(--radius-pill)',
              fontFamily: 'var(--font-primary)',
              fontSize: 'var(--font-size-16)',
            }}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}

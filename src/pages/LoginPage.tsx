import { useState } from 'react'
import { toast } from 'sonner'
import { Eye, EyeSlash } from '@phosphor-icons/react'
import { useAuthStore } from '../store/authStore'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <img src="/logo.png" alt="Chico FC" width={72} height={72} />
          <p style={{ color: 'var(--color-fg-secondary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-14)' }}>
            O app da nossa pelada
          </p>
        </div>
      </div>

      <div className="px-6 pb-12 flex flex-col gap-6">
        <div className="flex flex-col gap-2 items-center">
          <h1 style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-32)', fontWeight: 700 }}>
            Entrar
          </h1>
          <p style={{ color: 'var(--color-fg-secondary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-18)' }}>
            Digite seu email e a senha
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-center px-6 py-4"
              style={{ background: 'var(--color-surface-primary)', borderRadius: 'var(--radius-pill)' }}>
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
            <div className="flex items-center px-6 py-4 gap-3"
              style={{ background: 'var(--color-surface-primary)', borderRadius: 'var(--radius-pill)' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Senha"
                required
                autoComplete="current-password"
                className="flex-1 bg-transparent outline-none font-medium"
                style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)' }}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)}>
                {showPassword
                  ? <EyeSlash size={20} color="var(--color-fg-secondary)" />
                  : <Eye size={20} color="var(--color-fg-secondary)" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !filled}
            className="w-full py-4 font-medium transition-all active:scale-95"
            style={{
              background: filled && !loading ? 'var(--btn-primary-bg)' : 'var(--color-surface-secondary)',
              color: filled && !loading ? 'var(--btn-primary-fg)' : 'var(--color-fg-secondary)',
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

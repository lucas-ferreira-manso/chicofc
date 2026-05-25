import { useState } from 'react'
import { toast } from 'sonner'
import { Eye, EyeSlash } from '@phosphor-icons/react'
import { sendPasswordResetEmail } from 'firebase/auth'
import { auth } from '../lib/firebase'
import { useAuthStore } from '../store/authStore'
import TermsContent from '../components/TermsContent'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [termsChecked, setTermsChecked] = useState(false)
  const [showTermsText, setShowTermsText] = useState(false)
  const signIn = useAuthStore(s => s.signIn)

  const handleForgotPassword = async () => {
    const trimmed = email.trim().toLowerCase()
    if (!trimmed) {
      toast.error('Digite seu email primeiro')
      return
    }
    setResetLoading(true)
    try {
      await sendPasswordResetEmail(auth, trimmed)
      toast.success('Email de recuperação enviado!')
    } catch {
      toast.error('Não foi possível enviar o email. Verifique o endereço.')
    } finally {
      setResetLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await signIn(email.trim().toLowerCase(), password)
    setLoading(false)
    if (error) toast.error(error)
  }

  const filled = email.length > 0 && password.length > 0 && termsChecked

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: 'var(--color-bg)' }}>
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <img src="/logo.png" alt="Chico FC" width={144} height={144} />
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

          {/* Checkbox de termos */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={termsChecked}
              onChange={e => setTermsChecked(e.target.checked)}
              style={{ width: 18, height: 18, accentColor: 'var(--color-fg-accent)', flexShrink: 0 }}
            />
            <span style={{ fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-13)', color: 'var(--color-fg-secondary)', lineHeight: 1.4 }}>
              Li e aceito os{' '}
              <button
                type="button"
                onClick={() => setShowTermsText(true)}
                style={{ background: 'none', border: 'none', padding: 0, color: 'var(--color-fg-accent)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-13)', textDecoration: 'underline', cursor: 'pointer' }}>
                Termos da Pelada
              </button>
            </span>
          </label>

          <button
            type="button"
            disabled={resetLoading}
            onClick={handleForgotPassword}
            className="self-center"
            style={{ color: 'var(--color-fg-secondary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-14)', background: 'none', border: 'none' }}
          >
            {resetLoading ? 'Enviando...' : 'Esqueci minha senha'}
          </button>

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
      {/* Modal leitura dos termos (no login, sem aceite — só leitura) */}
      {showTermsText && (
        <>
          <div onClick={() => setShowTermsText(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 80 }} />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 90,
            background: 'var(--color-bg)', borderRadius: '24px 24px 0 0',
            padding: '28px 24px 40px', display: 'flex', flexDirection: 'column', gap: 20,
            maxHeight: '85dvh', overflowY: 'auto'
          }}>
            <TermsContent />
            <button
              onClick={() => { setTermsChecked(true); setShowTermsText(false) }}
              style={{
                width: '100%', padding: '16px', borderRadius: 9999,
                background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-fg)',
                fontFamily: 'var(--font-primary)', fontWeight: 600,
                fontSize: 'var(--font-size-16)', border: 'none', cursor: 'pointer'
              }}>
              Entendido, aceito ✅
            </button>
          </div>
        </>
      )}
    </div>
  )
}

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { doc, updateDoc } from 'firebase/firestore'
import { updatePassword, getAuth } from 'firebase/auth'
import { db } from '../lib/firebase'
import { useAuthStore } from '../store/authStore'
import { toast } from 'sonner'
import { CaretRight, Eye, EyeSlash, PencilSimple } from '@phosphor-icons/react'
import Header from '../components/layout/Header'
import Toggle from '../components/Toggle'
import ChinelinhoSheet from '../components/ChinelinhoSheet'

const auth = getAuth()

const CLOUDINARY_CLOUD_NAME = 'drbxsij7y'
const CLOUDINARY_UPLOAD_PRESET = 'chico-preset'

export default function ProfilePage() {
  const user = useAuthStore(s => s.user)
  const setUser = useAuthStore(s => s.setUser)
  const signOut = useAuthStore(s => s.signOut)
  const [showNameForm, setShowNameForm] = useState(false)
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [name, setName] = useState(user?.name ?? '')
  const [newPassword, setNewPassword] = useState('')
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme')
    if (saved === 'dark') return true
    if (saved === 'light') return false
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })
  const [showChinelinhoSheet, setShowChinelinhoSheet] = useState(false)
  const [uploading, setUploading] = useState(false)
  // Estado local para exibir a nova foto imediatamente após upload
  const [localAvatarUrl, setLocalAvatarUrl] = useState<string | null>(null)
  // Incrementado após cada upload para forçar re-montagem do input —
  // garante que onChange dispara mesmo selecionando o mesmo arquivo
  const [inputKey, setInputKey] = useState(0)

  // Prioriza o estado local (recém feito upload), senão usa o do store
  const avatarUrl = localAvatarUrl ?? user?.photoURL ?? null

  const initials = (user?.name || user?.email || '?')
    .split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user?.id) return

    // Validações
    if (!file.type.startsWith('image/')) {
      toast.error('Selecione um arquivo de imagem.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Foto muito grande. Máximo 5MB.')
      return
    }

    setUploading(true)
    // Guarda URL anterior para reverter em caso de erro no Firestore
    const previousUrl = localAvatarUrl ?? user.photoURL ?? null

    try {
      // ── 1. Upload para o Cloudinary ──────────────────────────────────────
      const formData = new FormData()
      formData.append('file', file)
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET)
      // Não enviamos public_id — deixamos o Cloudinary gerar automaticamente,
      // pois presets unsigned frequentemente bloqueiam public_id personalizado
      // e retornam erro 400, impedindo o upload de usuários com foto já existente.

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
        { method: 'POST', body: formData }
      )

      const data = await response.json()

      if (!response.ok) {
        console.error('[Avatar] Cloudinary error:', data)
        throw new Error(data.error?.message || 'Falha no upload da imagem')
      }

      const url: string = data.secure_url

      // Mostra a nova foto imediatamente
      setLocalAvatarUrl(url)

      // ── 2. Salva URL no Firestore ────────────────────────────────────────
      try {
        await updateDoc(doc(db, 'players', user.id), { photoURL: url })
        setUser(Object.assign({}, user, { photoURL: url }))
        toast.success('Foto atualizada!')
      } catch (firestoreErr) {
        // Upload ok, mas salvamento falhou: reverte exibição local para não
        // enganar o usuário (foto pareceria atualizada mas voltaria no próximo login)
        console.error('[Avatar] Firestore save error:', firestoreErr)
        setLocalAvatarUrl(previousUrl)
        toast.error('Foto enviada mas não foi possível salvar. Tente novamente.')
      }

    } catch (uploadErr: any) {
      console.error('[Avatar] Upload error:', uploadErr)
      setLocalAvatarUrl(previousUrl)
      toast.error(uploadErr.message || 'Erro ao enviar foto. Tente novamente.')
    } finally {
      setUploading(false)
      // Remonta o input para permitir selecionar o mesmo arquivo novamente
      setInputKey(k => k + 1)
    }
  }

  const updateName = useMutation({
    mutationFn: async () => { await updateDoc(doc(db, 'players', user!.id), { name }) },
    onSuccess: () => {
      setUser(Object.assign({}, user, { name }))
      toast.success('Nome atualizado!')
      setShowNameForm(false)
    }
  })

  const toggleDarkMode = (value: boolean) => {
    setIsDark(value)
    if (value) {
      document.documentElement.classList.add('dark')
      document.documentElement.classList.remove('light')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      document.documentElement.classList.add('light')
      localStorage.setItem('theme', 'light')
    }
  }

  // Chinelinho helpers
  const isChinelinhoActive = !!(
    user?.chinelinhoActive &&
    (!user.chinelinhoUntil || new Date(user.chinelinhoUntil) > new Date())
  )

  const handleChinelinhoToggle = async (value: boolean) => {
    if (value) {
      setShowChinelinhoSheet(true)
    } else {
      // Desativar
      try {
        await updateDoc(doc(db, 'players', user!.id), { chinelinhoActive: false, chinelinhoUntil: null })
        setUser(Object.assign({}, user, { chinelinhoActive: false, chinelinhoUntil: null }))
        toast.success('Modo Chinelinho desativado 🏃')
      } catch {
        toast.error('Erro ao desativar. Tente novamente.')
      }
    }
  }

  const handleChinelinhoActivate = async (until: string | null) => {
    try {
      await updateDoc(doc(db, 'players', user!.id), { chinelinhoActive: true, chinelinhoUntil: until })
      setUser(Object.assign({}, user, { chinelinhoActive: true, chinelinhoUntil: until }))
      setShowChinelinhoSheet(false)
      const msg = until
        ? `Modo Chinelinho ativado até ${new Date(until).toLocaleDateString('pt-BR')} 🩴`
        : 'Modo Chinelinho ativado indefinidamente 🩴'
      toast(msg)
    } catch {
      toast.error('Erro ao ativar. Tente novamente.')
    }
  }

  const changePassword = useMutation({
    mutationFn: async () => {
      if (!auth.currentUser) throw new Error()
      await updatePassword(auth.currentUser, newPassword)
    },
    onSuccess: () => { toast.success('Senha alterada!'); setNewPassword(''); setShowPasswordForm(false) },
    onError: () => toast.error('Erro ao alterar. Faça login novamente.')
  })

  const inputStyle: React.CSSProperties = {
    background: 'var(--color-surface-primary)',
    borderRadius: 'var(--radius-pill)',
    border: 'none', outline: 'none',
    padding: '14px 20px',
    fontFamily: 'var(--font-primary)',
    fontSize: 'var(--font-size-16)',
    color: 'var(--color-fg-primary)',
    width: '100%'
  }

  return (
    <div className="flex flex-col min-h-full pb-28" style={{ background: 'var(--color-bg)' }}>
      <Header title="Atleta" />
      <div style={{ height: 80 }} />

      {/* Input nativo — acionado via label htmlFor (sem .click() programático).
          display:none funciona aqui porque a abertura vem do label, não de JS.
          key muda após cada upload para forçar re-montagem e permitir
          selecionar o mesmo arquivo repetidamente. */}
      <input
        key={inputKey}
        id="avatar-upload-input"
        type="file"
        accept="image/*"
        disabled={uploading}
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      <div className="px-6 flex flex-col gap-4">
        {/* Card avatar */}
        <div className="flex flex-col items-center gap-4 px-5 py-6 rounded-[20px]"
          style={{ background: 'var(--color-surface-primary)' }}>

          <div className="relative w-[98px] h-[98px]">
            <div className="w-[98px] h-[98px] rounded-full flex items-center justify-center overflow-hidden"
              style={{ background: 'var(--color-avatar-bg)' }}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <p style={{ color: 'var(--color-avatar-fg)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-32)', fontWeight: 700 }}>
                  {initials}
                </p>
              )}
            </div>
            {uploading && (
              <div className="absolute inset-0 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(0,0,0,0.4)' }}>
                <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
                  style={{ borderColor: 'white' }} />
              </div>
            )}
          </div>

          <label
            htmlFor={uploading ? undefined : 'avatar-upload-input'}
            className="flex items-center gap-2 transition-all active:scale-95"
            style={{
              cursor: uploading ? 'default' : 'pointer',
              opacity: uploading ? 0.4 : 1,
              userSelect: 'none'
            }}>
            <PencilSimple size={16} color="var(--color-fg-primary)" />
            <p style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-14)', fontWeight: 500 }}>
              {uploading ? 'Enviando...' : 'Editar foto'}
            </p>
          </label>

          <p style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-24)', fontWeight: 600, lineHeight: '28px', textAlign: 'center', width: '100%' }}>
            {user?.name || 'Sem nome'}
          </p>

          <div className="flex items-center gap-2.5">
            <span className="px-4 py-2 rounded-full font-semibold"
              style={{ background: 'var(--color-surface-accent-light)', color: 'var(--color-fg-accent-light)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-12)' }}>
              {user?.player_type === 'mensalista' ? 'Mensalista' : 'Avulso'}
            </span>
            {user?.role === 'admin' && (
              <span className="px-4 py-2 rounded-full font-semibold"
                style={{ background: '#a8ffbb', color: '#089527', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-12)' }}>
                Admin
              </span>
            )}
          </div>
        </div>

        <div style={{ height: 1, background: 'var(--color-border)' }} />

        <div className="flex flex-col gap-2 py-2">
          <button onClick={() => { setShowNameForm(!showNameForm); setShowPasswordForm(false) }}
            className="w-full flex items-center justify-between px-5 py-4 rounded-3xl transition-all active:scale-[0.99]"
            style={{ background: 'var(--color-surface-primary)', height: 64 }}>
            <p style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-14)' }}>Trocar Nome</p>
            <CaretRight size={20} weight="regular" color="var(--color-fg-secondary)" />
          </button>

          {showNameForm && (
            <div className="flex flex-col gap-3 px-1">
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Novo nome" style={inputStyle} />
              <button onClick={() => updateName.mutate()} disabled={updateName.isPending || !name || name === user?.name}
                className="w-full py-4 font-medium transition-all active:scale-95 disabled:opacity-40"
                style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-fg)', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)' }}>
                {updateName.isPending ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          )}

          <button onClick={() => { setShowPasswordForm(!showPasswordForm); setShowNameForm(false); setShowPassword(false) }}
            className="w-full flex items-center justify-between px-5 py-4 rounded-3xl transition-all active:scale-[0.99]"
            style={{ background: 'var(--color-surface-primary)', height: 64 }}>
            <p style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-14)' }}>Trocar senha</p>
            <CaretRight size={20} weight="regular" color="var(--color-fg-secondary)" />
          </button>

          {showPasswordForm && (
            <div className="flex flex-col gap-3 px-1">
              <div className="flex items-center gap-3 px-5"
                style={{ background: 'var(--color-surface-primary)', borderRadius: 'var(--radius-pill)', height: 52 }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Nova senha (mín. 6 caracteres)"
                  className="flex-1 bg-transparent outline-none"
                  style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)' }}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword
                    ? <EyeSlash size={20} color="var(--color-fg-secondary)" />
                    : <Eye size={20} color="var(--color-fg-secondary)" />}
                </button>
              </div>
              <button onClick={() => changePassword.mutate()} disabled={changePassword.isPending || newPassword.length < 6}
                className="w-full py-4 font-medium transition-all active:scale-95 disabled:opacity-40"
                style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-fg)', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)' }}>
                {changePassword.isPending ? 'Alterando...' : 'Confirmar'}
              </button>
            </div>
          )}

          <div className="flex items-center justify-between px-5 rounded-3xl"
            style={{ background: 'var(--color-surface-primary)', height: 64 }}>
            <p style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-14)' }}>
              Dark Mode
            </p>
            <Toggle active={isDark} onChange={toggleDarkMode} />
          </div>

          <div className="flex items-center justify-between px-5 rounded-3xl"
            style={{ background: 'var(--color-surface-primary)', height: 64 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <p style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-14)' }}>
                Modo Chinelinho 🩴
              </p>
              {isChinelinhoActive && user?.chinelinhoUntil && (
                <p style={{ color: 'var(--color-fg-secondary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-11)' }}>
                  até {new Date(user.chinelinhoUntil).toLocaleDateString('pt-BR')}
                </p>
              )}
              {isChinelinhoActive && !user?.chinelinhoUntil && (
                <p style={{ color: 'var(--color-fg-secondary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-11)' }}>
                  desativação manual
                </p>
              )}
            </div>
            <Toggle active={isChinelinhoActive} onChange={handleChinelinhoToggle} />
          </div>
        </div>

        <p style={{ color: 'var(--color-fg-secondary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-12)', paddingTop: 4 }}>
          Versão {__APP_VERSION__}
        </p>

        <button onClick={signOut}
          className="w-full py-4 font-medium transition-all active:scale-95 text-left"
          style={{ color: 'var(--color-fg-secondary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)' }}>
          Sair do app
        </button>
      </div>

      {showChinelinhoSheet && (
        <ChinelinhoSheet
          onClose={() => setShowChinelinhoSheet(false)}
          onActivate={handleChinelinhoActivate}
        />
      )}
    </div>
  )
}

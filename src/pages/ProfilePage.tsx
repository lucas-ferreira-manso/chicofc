import { useState, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { doc, updateDoc } from 'firebase/firestore'
import { updatePassword, getAuth } from 'firebase/auth'
import { db } from '../lib/firebase'
import { useAuthStore } from '../store/authStore'
import { toast } from 'sonner'
import { CaretRight, Eye, EyeSlash, PencilSimple } from '@phosphor-icons/react'
import Header from '../components/layout/Header'

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
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Lê sempre do store — nunca perde após navegação
  const avatarUrl = user?.photoURL ?? null

  const initials = (user?.name || user?.email || '?')
    .split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()

  const handleAvatarTap = () => fileInputRef.current?.click()

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user?.id) return
    if (file.size > 5 * 1024 * 1024) { toast.error('Foto muito grande. Máximo 5MB.'); return }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET)
      formData.append('public_id', `avatar_${user.id}`)

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
        { method: 'POST', body: formData }
      )

      const data = await response.json()
      console.log('Cloudinary response:', data)

      if (!response.ok) {
        throw new Error(data.error?.message || 'Falha no upload')
      }

      const url = data.secure_url

      // Salva no Firestore
      await updateDoc(doc(db, 'players', user.id), { photoURL: url })

      // Atualiza o store — a UI reage automaticamente
      setUser({ ...user, photoURL: url })

      toast.success('Foto atualizada!')
    } catch (e) {
      console.error('Erro upload avatar:', e)
      toast.error('Erro ao enviar foto. Tente novamente.')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const updateName = useMutation({
    mutationFn: async () => { await updateDoc(doc(db, 'players', user!.id), { name }) },
    onSuccess: () => {
      setUser({ ...user!, name })
      toast.success('Nome atualizado!')
      setShowNameForm(false)
    }
  })

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

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
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

          <button onClick={handleAvatarTap} disabled={uploading}
            className="flex items-center gap-2 transition-all active:scale-95 disabled:opacity-40">
            <PencilSimple size={16} color="var(--color-fg-primary)" />
            <p style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-14)', fontWeight: 500 }}>
              Editar foto
            </p>
          </button>

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
        </div>

        <button onClick={signOut}
          className="w-full py-4 font-medium transition-all active:scale-95 text-left px-5"
          style={{ color: 'var(--color-fg-secondary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)' }}>
          Sair do app
        </button>
      </div>
    </div>
  )
}

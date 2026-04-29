import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { doc, updateDoc } from 'firebase/firestore'
import { updatePassword, getAuth } from 'firebase/auth'
import { db } from '../lib/firebase'
import { useAuthStore } from '../store/authStore'
import { toast } from 'sonner'
import { LogOut, Lock, Crown } from 'lucide-react'

const auth = getAuth()

export default function ProfilePage() {
  const user = useAuthStore(s => s.user)
  const signOut = useAuthStore(s => s.signOut)
  const [name, setName] = useState(user?.name ?? '')
  const [newPassword, setNewPassword] = useState('')
  const [showPasswordForm, setShowPasswordForm] = useState(false)

  const updateName = useMutation({
    mutationFn: async () => { await updateDoc(doc(db, 'players', user!.id), { name }) },
    onSuccess: () => toast.success('Nome atualizado!')
  })

  const changePassword = useMutation({
    mutationFn: async () => { if (!auth.currentUser) throw new Error(); await updatePassword(auth.currentUser, newPassword) },
    onSuccess: () => { toast.success('Senha alterada!'); setNewPassword(''); setShowPasswordForm(false) },
    onError: () => toast.error('Erro ao alterar. Faça login novamente.')
  })

  const typeLabel = user?.player_type === 'mensalista' ? 'Mensalista' : 'Avulso'

  const inputStyle: React.CSSProperties = {
    background: 'var(--color-surface-primary)',
    borderRadius: 'var(--radius-pill)',
    border: 'none',
    outline: 'none',
    padding: '14px 20px',
    fontFamily: 'var(--font-primary)',
    fontSize: 'var(--font-size-16)',
    color: 'var(--color-fg-primary)',
    width: '100%'
  }

  return (
    <div className="flex flex-col min-h-full pb-28 px-6" style={{ background: 'var(--color-bg)' }}>
      <div className="pt-12 pb-6">
        <p className="font-bold" style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-32)' }}>
          Atleta
        </p>
      </div>

      {/* Avatar + info */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-16 h-16 rounded-full flex items-center justify-center font-bold text-2xl shrink-0"
          style={{ background: 'var(--color-surface-accent-light)', color: 'var(--color-fg-accent)', fontFamily: 'var(--font-primary)' }}>
          {(user?.name || user?.email || '?')[0].toUpperCase()}
        </div>
        <div>
          <p className="font-semibold" style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-18)' }}>
            {user?.name || 'Sem nome'}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium"
              style={{ background: user?.player_type === 'mensalista' ? '#e8edff' : '#f0fdf4', color: user?.player_type === 'mensalista' ? 'var(--color-fg-accent)' : '#166534', fontFamily: 'var(--font-primary)' }}>
              {typeLabel}
            </span>
            {user?.role === 'admin' && (
              <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium"
                style={{ background: '#fefce8', color: '#854d0e', fontFamily: 'var(--font-primary)' }}>
                <Crown size={10} /> Admin
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="h-px mb-6" style={{ background: 'var(--color-border)' }} />

      {/* Editar nome */}
      <div className="flex flex-col gap-3 mb-3">
        <p style={{ color: 'var(--color-fg-secondary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-14)' }}>Seu nome</p>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Como quer ser chamado" style={inputStyle} />
        <button onClick={() => updateName.mutate()} disabled={updateName.isPending || name === user?.name}
          className="w-full py-4 font-medium transition-all active:scale-95 disabled:opacity-40"
          style={{ background: 'var(--color-surface-accent)', color: 'white', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)' }}>
          {updateName.isPending ? 'Salvando...' : 'Salvar nome'}
        </button>
      </div>

      {/* Trocar senha */}
      <button onClick={() => setShowPasswordForm(!showPasswordForm)}
        className="w-full flex items-center justify-center gap-2 py-4 mb-3 font-medium transition-all active:scale-95"
        style={{ background: 'var(--color-surface-primary)', borderRadius: 'var(--radius-pill)', color: 'var(--color-fg-secondary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)' }}>
        <Lock size={16} /> Trocar senha
      </button>

      {showPasswordForm && (
        <div className="flex flex-col gap-3 mb-3">
          <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
            placeholder="Nova senha (mín. 6 caracteres)" style={inputStyle} />
          <button onClick={() => changePassword.mutate()} disabled={changePassword.isPending || newPassword.length < 6}
            className="w-full py-4 font-medium transition-all active:scale-95 disabled:opacity-40"
            style={{ background: 'var(--color-surface-accent)', color: 'white', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)' }}>
            {changePassword.isPending ? 'Alterando...' : 'Confirmar nova senha'}
          </button>
        </div>
      )}

      <div className="mt-auto pt-8">
        <button onClick={signOut}
          className="w-full flex items-center justify-center gap-2 py-4 font-medium transition-all active:scale-95"
          style={{ background: '#fff1f0', color: 'var(--color-danger)', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)' }}>
          <LogOut size={16} /> Sair da conta
        </button>
      </div>
    </div>
  )
}

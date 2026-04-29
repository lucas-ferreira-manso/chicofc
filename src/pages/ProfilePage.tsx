import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { doc, updateDoc } from 'firebase/firestore'
import { updatePassword, getAuth } from 'firebase/auth'
import { db } from '../lib/firebase'
import { useAuthStore } from '../store/authStore'
import { toast } from 'sonner'
import { LogOut, Crown, Lock } from 'lucide-react'

const auth = getAuth()

export default function ProfilePage() {
  const user = useAuthStore(s => s.user)
  const signOut = useAuthStore(s => s.signOut)
  const [name, setName] = useState(user?.name ?? '')
  const [newPassword, setNewPassword] = useState('')
  const [showPasswordForm, setShowPasswordForm] = useState(false)

  const updateName = useMutation({
    mutationFn: async () => {
      await updateDoc(doc(db, 'players', user!.id), { name })
    },
    onSuccess: () => toast.success('Nome atualizado!')
  })

  const changePassword = useMutation({
    mutationFn: async () => {
      if (!auth.currentUser) throw new Error('Não autenticado')
      await updatePassword(auth.currentUser, newPassword)
    },
    onSuccess: () => {
      toast.success('Senha alterada!')
      setNewPassword('')
      setShowPasswordForm(false)
    },
    onError: () => toast.error('Erro ao alterar senha. Faça login novamente.')
  })

  const typeLabel = user?.player_type === 'mensalista' ? 'Mensalista' : 'Avulso'
  const typeColor = user?.player_type === 'mensalista' ? '#4ade80' : '#818cf8'
  const typeBg = user?.player_type === 'mensalista' ? '#1e3a2e' : '#1a1a2e'

  return (
    <div className="flex flex-col min-h-full pb-24 px-4">
      <div className="pt-6 pb-4">
        <h1 className="text-2xl font-bold text-white">Perfil</h1>
      </div>

      <div className="flex flex-col items-center py-8">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold"
          style={{ background: 'var(--surface2)', color: 'var(--green)', border: '2px solid var(--border)' }}
        >
          {(user?.name || user?.email || '?')[0].toUpperCase()}
        </div>
        <p className="mt-3 font-semibold text-white">{user?.name || 'Sem nome'}</p>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{user?.email}</p>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: typeBg, color: typeColor }}>
            {typeLabel}
          </span>
          {user?.role === 'admin' && (
            <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: '#2d2a00', color: '#fbbf24' }}>
              <Crown size={11} /> Admin
            </span>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm mb-1.5" style={{ color: 'var(--text-muted)' }}>Seu nome</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Como quer ser chamado"
            className="w-full px-4 py-3 rounded-xl text-white outline-none"
            style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}
          />
        </div>
        <button
          onClick={() => updateName.mutate()}
          disabled={updateName.isPending || name === user?.name}
          className="w-full py-3 rounded-xl font-semibold text-white transition-all active:scale-95 disabled:opacity-40"
          style={{ background: 'var(--green)' }}
        >
          {updateName.isPending ? 'Salvando...' : 'Salvar nome'}
        </button>

        {/* Trocar senha */}
        <button
          onClick={() => setShowPasswordForm(!showPasswordForm)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium"
          style={{ color: 'var(--text-muted)', background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <Lock size={15} /> Trocar senha
        </button>

        {showPasswordForm && (
          <div className="space-y-3">
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="Nova senha (mínimo 6 caracteres)"
              className="w-full px-4 py-3 rounded-xl text-white outline-none"
              style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}
            />
            <button
              onClick={() => changePassword.mutate()}
              disabled={changePassword.isPending || newPassword.length < 6}
              className="w-full py-3 rounded-xl font-semibold text-white transition-all active:scale-95 disabled:opacity-40"
              style={{ background: 'var(--green)' }}
            >
              {changePassword.isPending ? 'Alterando...' : 'Confirmar nova senha'}
            </button>
          </div>
        )}
      </div>

      <div className="mt-auto pt-10">
        <button
          onClick={signOut}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium"
          style={{ color: '#f87171', background: '#7f1d1d22', border: '1px solid #7f1d1d44' }}
        >
          <LogOut size={16} /> Sair da conta
        </button>
      </div>
    </div>
  )
}

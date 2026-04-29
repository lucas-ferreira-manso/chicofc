import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { collection, getDocs, doc, updateDoc, setDoc, deleteDoc } from 'firebase/firestore'
import { createUserWithEmailAndPassword, getAuth } from 'firebase/auth'
import { db } from '../lib/firebase'
import { useAuthStore } from '../store/authStore'
import { toast } from 'sonner'
import { UserPlus, Trash2, Crown, Shield, ToggleLeft, ToggleRight } from 'lucide-react'
import type { Profile } from '../types'

const auth = getAuth()

async function fetchPlayers(): Promise<Profile[]> {
  const snap = await getDocs(collection(db, 'players'))
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Profile))
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
}

export default function AdminPage() {
  const qc = useQueryClient()
  const user = useAuthStore(s => s.user)
  const isAdmin = user?.role === 'admin'

  const { data: players = [], isLoading } = useQuery({ queryKey: ['players'], queryFn: fetchPlayers })

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    player_type: 'mensalista' as 'mensalista' | 'avulso',
    role: 'player' as 'admin' | 'player'
  })

  const createPlayer = useMutation({
    mutationFn: async () => {
      // Cria usuário no Firebase Auth
      const result = await createUserWithEmailAndPassword(auth, form.email, form.password)
      // Salva perfil no Firestore
      await setDoc(doc(db, 'players', result.user.uid), {
        name: form.name,
        email: form.email.toLowerCase(),
        player_type: form.player_type,
        role: form.role,
        active: true,
        created_at: new Date().toISOString()
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['players'] })
      toast.success(`${form.name} adicionado!`)
      setForm({ name: '', email: '', password: '', player_type: 'mensalista', role: 'player' })
      setShowForm(false)
    },
    onError: (e: any) => {
      const msg = e.code === 'auth/email-already-in-use'
        ? 'Email já cadastrado.'
        : 'Erro ao adicionar jogador.'
      toast.error(msg)
    }
  })

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      await updateDoc(doc(db, 'players', id), { active: !active })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['players'] })
      toast.success('Atualizado!')
    }
  })

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full py-20 px-4 text-center">
        <Shield size={48} style={{ color: 'var(--text-muted)' }} className="mb-4" />
        <p className="text-white font-semibold">Acesso restrito</p>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Só admins podem ver essa página.</p>
      </div>
    )
  }

  const inputStyle = { background: 'var(--surface2)', border: '1px solid var(--border)' }

  return (
    <div className="flex flex-col min-h-full pb-24">
      <div className="px-4 pt-6 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Jogadores</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {players.filter(p => p.active).length} ativos · {players.filter(p => !p.active).length} inativos
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-white text-sm"
          style={{ background: showForm ? '#7f1d1d' : 'var(--green)' }}
        >
          <UserPlus size={16} /> {showForm ? 'Fechar' : 'Adicionar'}
        </button>
      </div>

      {/* Formulário de novo jogador */}
      {showForm && (
        <div className="mx-4 mb-4 p-4 rounded-2xl space-y-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h2 className="text-sm font-semibold text-white">Novo jogador</h2>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Nome</label>
            <input
              type="text"
              placeholder="João Silva"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl text-white outline-none text-sm"
              style={inputStyle}
            />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Email</label>
            <input
              type="email"
              placeholder="joao@email.com"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl text-white outline-none text-sm"
              style={inputStyle}
            />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Senha inicial</label>
            <input
              type="text"
              placeholder="Senha para o jogador entrar"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl text-white outline-none text-sm"
              style={inputStyle}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Tipo</label>
              <select
                value={form.player_type}
                onChange={e => setForm(f => ({ ...f, player_type: e.target.value as any }))}
                className="w-full px-3 py-2.5 rounded-xl text-white outline-none text-sm"
                style={inputStyle}
              >
                <option value="mensalista">Mensalista</option>
                <option value="avulso">Avulso</option>
              </select>
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Papel</label>
              <select
                value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value as any }))}
                className="w-full px-3 py-2.5 rounded-xl text-white outline-none text-sm"
                style={inputStyle}
              >
                <option value="player">Jogador</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <button
            onClick={() => createPlayer.mutate()}
            disabled={createPlayer.isPending || !form.name || !form.email || !form.password}
            className="w-full py-3 rounded-xl font-semibold text-white transition-all active:scale-95 disabled:opacity-40"
            style={{ background: 'var(--green)' }}
          >
            {createPlayer.isPending ? 'Criando...' : 'Adicionar jogador'}
          </button>
        </div>
      )}

      {/* Lista de jogadores */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center"><div className="text-4xl animate-spin">⚽</div></div>
      ) : (
        <div className="px-4 space-y-2">
          {players.map(player => (
            <div
              key={player.id}
              className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                opacity: player.active ? 1 : 0.5
              }}
            >
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                style={{ background: 'var(--surface2)', color: 'var(--green)' }}
              >
                {(player.name || player.email || '?')[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium text-white truncate">{player.name || 'Sem nome'}</p>
                  {player.role === 'admin' && <Crown size={12} style={{ color: '#fbbf24', flexShrink: 0 }} />}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span
                    className="text-xs px-1.5 py-0.5 rounded"
                    style={{
                      background: player.player_type === 'mensalista' ? '#1e3a2e' : '#1a1a2e',
                      color: player.player_type === 'mensalista' ? '#4ade80' : '#818cf8'
                    }}
                  >
                    {player.player_type}
                  </span>
                  <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{player.email}</p>
                </div>
              </div>
              <button
                onClick={() => toggleActive.mutate({ id: player.id, active: player.active })}
                style={{ color: player.active ? 'var(--green)' : 'var(--text-muted)' }}
              >
                {player.active ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

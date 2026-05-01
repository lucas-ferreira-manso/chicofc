import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { collection, getDocs, doc, updateDoc, setDoc } from 'firebase/firestore'
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, getAuth, getIdToken } from 'firebase/auth'
import { db } from '../lib/firebase'
import { useAuthStore } from '../store/authStore'
import { toast } from 'sonner'
import { UserPlus, Shield, ToggleLeft, ToggleRight, Crown, X, Bell } from '@phosphor-icons/react'
import Header from '../components/layout/Header'
import { format, isWednesday, nextWednesday, startOfDay } from 'date-fns'
import type { Profile } from '../types'

const auth = getAuth()
const SERVER_URL = 'https://chicofc-server.onrender.com'

function getNextWednesdayId(): string {
  const today = startOfDay(new Date())
  const wed = isWednesday(today) ? today : nextWednesday(today)
  return format(wed, 'yyyy-MM-dd')
}

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
  const [showNotifForm, setShowNotifForm] = useState(false)
  const [notifMessage, setNotifMessage] = useState('')
  const [form, setForm] = useState({
    name: '', email: '', password: '',
    player_type: 'mensalista' as 'mensalista' | 'avulso',
    role: 'player' as 'admin' | 'player'
  })

  const createPlayer = useMutation({
    mutationFn: async () => {
      const adminEmail = user!.email
      const adminPassword = window.prompt('Digite sua senha para confirmar:')
      if (!adminPassword) throw new Error('cancelled')
      const result = await createUserWithEmailAndPassword(auth, form.email, form.password)
      await setDoc(doc(db, 'players', result.user.uid), {
        name: form.name, email: form.email.toLowerCase(),
        player_type: form.player_type, role: form.role,
        active: true, created_at: new Date().toISOString()
      })
      await signInWithEmailAndPassword(auth, adminEmail, adminPassword)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['players'] })
      toast.success(`${form.name} adicionado!`)
      setForm({ name: '', email: '', password: '', player_type: 'mensalista', role: 'player' })
      setShowForm(false)
    },
    onError: (e: any) => {
      if (e.message === 'cancelled') return
      toast.error(e.code === 'auth/email-already-in-use' ? 'Email já cadastrado.' : 'Erro ao adicionar.')
    }
  })

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      await updateDoc(doc(db, 'players', id), { active: !active })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['players'] }); toast.success('Atualizado!') }
  })

  const sendNotification = useMutation({
    mutationFn: async () => {
      const currentUser = auth.currentUser
      if (!currentUser) throw new Error('Não autenticado')
      const token = await getIdToken(currentUser)
      const gameId = getNextWednesdayId()
      const res = await fetch(`${SERVER_URL}/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ gameId, message: notifMessage || 'Você ainda não confirmou presença no jogo de quarta!' })
      })
      if (!res.ok) throw new Error('Erro no servidor')
      return res.json()
    },
    onSuccess: (data) => {
      toast.success(`Notificação enviada para ${data.sent} jogador${data.sent !== 1 ? 'es' : ''}!`)
      setShowNotifForm(false)
      setNotifMessage('')
    },
    onError: (e: any) => toast.error(`Erro: ${e.message}`)
  })

  if (!isAdmin) return (
    <div className="flex flex-col items-center justify-center min-h-full py-20 px-4 text-center">
      <Shield size={48} color="var(--color-fg-secondary)" className="mb-4" />
      <p style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontWeight: 600 }}>Acesso restrito</p>
      <p style={{ color: 'var(--color-fg-secondary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-14)', marginTop: 4 }}>Só admins podem ver essa página.</p>
    </div>
  )

  const inputStyle: React.CSSProperties = {
    background: 'var(--color-surface-secondary)',
    borderRadius: 'var(--radius-pill)',
    border: 'none', outline: 'none',
    padding: '12px 20px',
    fontFamily: 'var(--font-primary)',
    fontSize: 'var(--font-size-16)',
    color: 'var(--color-fg-primary)',
    width: '100%'
  }

  return (
    <div className="flex flex-col min-h-full pb-28" style={{ background: 'var(--color-bg)' }}>
      <Header
        title="Admin"
        subtitle={`${players.filter(p => p.active).length} ativos`}
        rightContent={
          <div className="flex gap-2">
            <button onClick={() => { setShowNotifForm(!showNotifForm); setShowForm(false) }}
              className="flex items-center gap-2 px-4 py-2 rounded-full font-medium transition-all active:scale-95"
              style={{ background: 'var(--color-surface-accent-light)', color: 'var(--color-fg-accent-light)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-14)' }}>
              <Bell size={15} /> Notificar
            </button>
            <button onClick={() => { setShowForm(!showForm); setShowNotifForm(false) }}
              className="flex items-center gap-2 px-4 py-2 rounded-full font-medium transition-all active:scale-95"
              style={{ background: showForm ? 'var(--color-surface-secondary)' : 'var(--btn-primary-bg)', color: showForm ? 'var(--color-danger)' : 'var(--btn-primary-fg)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-14)' }}>
              {showForm ? <><X size={15} />Fechar</> : <><UserPlus size={15} />Adicionar</>}
            </button>
          </div>
        }
      />
      <div style={{ height: 96 }} />

      {showNotifForm && (
        <div className="mx-6 mb-4 p-5 rounded-3xl flex flex-col gap-3" style={{ background: 'var(--color-surface-primary)' }}>
          <p style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)', fontWeight: 600 }}>
            Notificar quem não confirmou
          </p>
          <p style={{ color: 'var(--color-fg-secondary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-14)' }}>
            Enviado para quem ainda não respondeu ao jogo desta quarta.
          </p>
          <input type="text" placeholder="Mensagem (opcional)" value={notifMessage}
            onChange={e => setNotifMessage(e.target.value)} style={inputStyle} />
          <button onClick={() => sendNotification.mutate()} disabled={sendNotification.isPending}
            className="w-full py-4 font-medium transition-all active:scale-95 disabled:opacity-40 flex items-center justify-center gap-2"
            style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-fg)', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)' }}>
            <Bell size={18} />
            {sendNotification.isPending ? 'Enviando...' : 'Enviar notificação'}
          </button>
        </div>
      )}

      {showForm && (
        <div className="mx-6 mb-4 p-5 rounded-3xl flex flex-col gap-3" style={{ background: 'var(--color-surface-primary)' }}>
          <p style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)', fontWeight: 600 }}>Novo jogador</p>
          <input type="text" placeholder="Nome" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} />
          <input type="email" placeholder="Email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={inputStyle} />
          <input type="text" placeholder="Senha inicial" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} style={inputStyle} />
          <div className="flex gap-3">
            <select value={form.player_type} onChange={e => setForm(f => ({ ...f, player_type: e.target.value as any }))}
              style={{ ...inputStyle, borderRadius: 'var(--radius-tag)' }}>
              <option value="mensalista">Mensalista</option>
              <option value="avulso">Avulso</option>
            </select>
            <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as any }))}
              style={{ ...inputStyle, borderRadius: 'var(--radius-tag)' }}>
              <option value="player">Jogador</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button onClick={() => createPlayer.mutate()} disabled={createPlayer.isPending || !form.name || !form.email || !form.password}
            className="w-full py-4 font-medium transition-all active:scale-95 disabled:opacity-40"
            style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-fg)', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)' }}>
            {createPlayer.isPending ? 'Criando...' : 'Adicionar jogador'}
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8"><div className="text-4xl animate-spin">⚽</div></div>
      ) : (
        <div className="px-6 flex flex-col gap-2">
          {players.map(player => (
            <div key={player.id} className="flex items-center gap-3 p-4 rounded-3xl"
              style={{ background: 'var(--color-surface-primary)', opacity: player.active ? 1 : 0.5 }}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold shrink-0"
                style={{ background: 'var(--color-surface-quaternary)', color: 'var(--color-fg-accent)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)' }}>
                {(player.name || player.email || '?')[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="font-medium truncate" style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)' }}>{player.name || 'Sem nome'}</p>
                  {player.role === 'admin' && <Crown size={12} color="#f59e0b" />}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="px-2 py-0.5 rounded-full text-xs"
                    style={{ background: 'var(--color-surface-accent-light)', color: 'var(--color-fg-accent-light)', fontFamily: 'var(--font-primary)' }}>
                    {player.player_type}
                  </span>
                  <p className="text-xs truncate" style={{ color: 'var(--color-fg-secondary)', fontFamily: 'var(--font-primary)' }}>{player.email}</p>
                </div>
              </div>
              <button onClick={() => toggleActive.mutate({ id: player.id, active: player.active })}
                style={{ color: player.active ? 'var(--color-success)' : 'var(--color-fg-secondary)' }}>
                {player.active ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { collection, getDocs, doc, setDoc, addDoc, query, where } from 'firebase/firestore'
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, getAuth, getIdToken } from 'firebase/auth'
import { db } from '../lib/firebase'
import { useAuthStore } from '../store/authStore'
import { toast } from 'sonner'
import { Shield, Bell, X, UserPlus } from '@phosphor-icons/react'
import { CaretDown } from '@phosphor-icons/react'
import Header from '../components/layout/Header'
import { format, isWednesday, nextWednesday, startOfDay } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import type { Profile } from '../types'

const auth = getAuth()
const SERVER_URL = 'https://chicofc-server.onrender.com'

function getNextWednesdayId(): string {
  const today = startOfDay(new Date())
  const wed = isWednesday(today) ? today : nextWednesday(today)
  return format(wed, 'yyyy-MM-dd')
}

function getInitials(name: string): string {
  return name.trim().split(' ').filter(Boolean).slice(0, 2).map(n => n[0].toUpperCase()).join('')
}

function PlayerAvatar({ name, photoURL, size = 32 }: { name: string; photoURL?: string; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: 'var(--color-avatar-bg)', overflow: 'hidden',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      {photoURL ? (
        <img src={photoURL} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <span style={{
          fontFamily: 'var(--font-primary)', fontWeight: 500,
          fontSize: size <= 32 ? 'var(--font-size-14)' : 'var(--font-size-18)',
          color: 'var(--color-avatar-fg)'
        }}>
          {getInitials(name)}
        </span>
      )}
    </div>
  )
}

export async function fetchPlayers(): Promise<Profile[]> {
  const snap = await getDocs(collection(db, 'players'))
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Profile))
    .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'))
}

function PlayerRow({ player, onClick }: { player: Profile; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      width: '100%', background: 'var(--color-surface-primary)',
      border: 'none', cursor: 'pointer', padding: 16, borderRadius: 24,
      height: 64, display: 'flex', alignItems: 'center', gap: 8,
      opacity: player.active ? 1 : 0.4
    }}>
      <PlayerAvatar name={player.name} photoURL={player.photoURL} size={32} />
      <p style={{
        flex: 1, fontFamily: 'var(--font-primary)', fontWeight: 500,
        fontSize: 'var(--font-size-16)', color: 'var(--color-fg-primary)',
        textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
      }}>
        {player.name}
      </p>
    </button>
  )
}

function SectionHeader({ title, count, onVerTodos }: { title: string; count: number; onVerTodos: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 600, fontSize: 'var(--font-size-16)', color: 'var(--color-fg-primary)' }}>
          {title}
        </p>
        <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 500, fontSize: 'var(--font-size-14)', color: 'var(--color-fg-secondary)' }}>
          {count} jogadores
        </p>
      </div>
      <button onClick={onVerTodos} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
        <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 500, fontSize: 'var(--font-size-14)', color: 'var(--color-fg-accent)' }}>
          Ver todos
        </p>
      </button>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  background: 'var(--color-surface-secondary)',
  borderRadius: 'var(--radius-pill)', border: 'none', outline: 'none',
  padding: '12px 20px', fontFamily: 'var(--font-primary)',
  fontSize: 'var(--font-size-16)', color: 'var(--color-fg-primary)', width: '100%'
}

export default function AdminPage() {
  const qc = useQueryClient()
  const user = useAuthStore(s => s.user)
  const navigate = useNavigate()


  const { data: players = [], isLoading } = useQuery({ queryKey: ['players'], queryFn: fetchPlayers })

  const [showAddSheet, setShowAddSheet] = useState(false)
  const [showNotifSheet, setShowNotifSheet] = useState(false)
  const [notifMessage, setNotifMessage] = useState('')
  const [notifType, setNotifType] = useState<'presenca' | 'cobranca'>('presenca')
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
      setShowAddSheet(false)
    },
    onError: (e: any) => {
      if (e.message === 'cancelled') return
      toast.error(e.code === 'auth/email-already-in-use' ? 'Email já cadastrado.' : 'Erro ao adicionar.')
    }
  })

  const sendNotification = useMutation({
    mutationFn: async () => {
      const currentUser = auth.currentUser
      if (!currentUser) throw new Error('Não autenticado')
      const token = await getIdToken(currentUser)
      if (notifType === 'presenca') {
        const gameId = getNextWednesdayId()
        const res = await fetch(`${SERVER_URL}/notify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ gameId, message: notifMessage || 'Você ainda não confirmou presença no jogo de quarta!' })
        })
        if (!res.ok) throw new Error('Erro no servidor')
        const data = await res.json()

        // Salva no Notification Center para quem não confirmou presença
        const [attendancesSnap, allPlayersSnap] = await Promise.all([
          getDocs(query(collection(db, 'attendances'), where('game_id', '==', gameId))),
          getDocs(query(collection(db, 'players'), where('active', '==', true)))
        ])
        const confirmedIds = new Set(
          attendancesSnap.docs
            .filter(d => ['confirmed', 'waitlist'].includes(d.data().status))
            .map(d => d.data().user_id)
        )
        const title = 'Confirmação de Presença'
        const msg = notifMessage || 'Você ainda não confirmou presença no jogo de quarta!'
        const now = new Date().toISOString()
        const toWrite = allPlayersSnap.docs.filter(d => !confirmedIds.has(d.id))
        await Promise.all(toWrite.map(d =>
          addDoc(collection(db, 'notifications'), {
            user_id: d.id, title, message: msg, type: 'message', read: false, created_at: now
          })
        ))
        return data
      } else {
        const month = format(new Date(), 'yyyy-MM')
        // Busca quem já pagou ou submeteu pedido de pagamento — para não notificar
        const [paidSnap, requestsSnap, unpaidJogoSnap, pendingJogoSnap] = await Promise.all([
          getDocs(query(collection(db, 'payments'),
            where('month', '==', month),
            where('type', '==', 'mensalidade'),
            where('paid', '==', true)
          )),
          getDocs(query(collection(db, 'payment_requests'),
            where('month', '==', month),
            where('player_type', '==', 'mensalista')
          )),
          getDocs(query(collection(db, 'payments'),
            where('type', '==', 'jogo'),
            where('paid', '==', false)
          )),
          getDocs(query(collection(db, 'payment_requests'),
            where('player_type', '==', 'avulso'),
            where('status', '==', 'pending')
          )),
        ])

        const paidMensalistaIds = new Set(paidSnap.docs.map(d => d.data().user_id))
        const requestedMensalistaIds = new Set(requestsSnap.docs.map(d => d.data().user_id))
        const avulsosWithUnpaid = new Set(unpaidJogoSnap.docs.map(d => d.data().user_id))
        const avulsosWithPendingRequest = new Set(pendingJogoSnap.docs.map(d => d.data().user_id))

        const activePlayers = players.filter(p => p.active)

        // Mensalistas que ainda não pagaram e não submeteram pedido
        const mensalistasToNotify = activePlayers.filter(p =>
          p.player_type === 'mensalista' &&
          !paidMensalistaIds.has(p.id) &&
          !requestedMensalistaIds.has(p.id)
        )

        // Avulsos com jogos pendentes e sem pedido ativo
        const avulsosToNotify = activePlayers.filter(p =>
          p.player_type === 'avulso' &&
          avulsosWithUnpaid.has(p.id) &&
          !avulsosWithPendingRequest.has(p.id)
        )

        const toNotify = [...mensalistasToNotify, ...avulsosToNotify]
        if (toNotify.length === 0) return { sent: 0 }

        const now = new Date().toISOString()
        const results = await Promise.all(toNotify.map(async p => {
          const msg = notifMessage || (p.player_type === 'mensalista'
            ? 'Você ainda tem mensalidade pendente. Por favor, efetue o pagamento!'
            : 'Você ainda tem pagamento de jogo pendente. Por favor, efetue o pagamento!')
          const res = await fetch(`${SERVER_URL}/notify-cobranca`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ userId: p.id, message: msg })
          })
          // Salva no Notification Center do usuário
          await addDoc(collection(db, 'notifications'), {
            user_id: p.id, title: 'Cobrança de Pagamento', message: msg,
            type: 'message', read: false, created_at: now
          })
          return res.ok ? 1 : 0
        }))

        return { sent: results.reduce((a: number, b: number) => a + b, 0) }
      }
    },
    onSuccess: (data) => {
      toast.success(`Notificação enviada para ${data.sent} jogador${data.sent !== 1 ? 'es' : ''}!`)
      setShowNotifSheet(false)
      setNotifMessage('')
      setNotifType('presenca')
    },
    onError: (e: any) => toast.error(`Erro: ${e.message}`)
  })

  if (user?.role !== 'admin') return (
    <div className="flex flex-col items-center justify-center min-h-full py-20 px-4 text-center">
      <Shield size={48} color="var(--color-fg-secondary)" className="mb-4" />
      <p style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontWeight: 600 }}>Acesso restrito</p>
    </div>
  )

  const activePlayers = players.filter(p => p.active)
  const mensalistas = activePlayers.filter(p => p.player_type === 'mensalista')
  const avulsos = activePlayers.filter(p => p.player_type === 'avulso')

  return (
    <div className="flex flex-col min-h-full" style={{ background: 'var(--color-bg)', paddingBottom: 'calc(var(--bottom-nav-height) + env(safe-area-inset-bottom) + 96px)' }}>
      <Header
        title="Admin"
        subtitle={`${activePlayers.length} ativos`}
        rightContent={
          <button onClick={() => { setShowAddSheet(true); setShowNotifSheet(false) }}
            className="w-8 h-8 flex items-center justify-center rounded-full transition-all active:scale-95"
            style={{ background: 'var(--btn-primary-bg)' }}>
            <UserPlus size={18} color="var(--btn-primary-fg)" />
          </button>
        }
      />
      <div style={{ height: 96 }} />

      {isLoading ? (
        <div className="flex justify-center py-8"><div className="text-4xl animate-spin">⚽</div></div>
      ) : (
        <div className="px-6 flex flex-col gap-6">
          {/* Mensalistas */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <SectionHeader
              title="Mensalistas"
              count={mensalistas.length}
              onVerTodos={() => navigate('/admin/jogadores/mensalista')}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {mensalistas.slice(0, 3).map(p => (
                <PlayerRow key={p.id} player={p} onClick={() => navigate(`/admin/jogador/${p.id}`)} />
              ))}
            </div>
          </div>

          {/* Avulsos */}
          {avulsos.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <SectionHeader
                title="Avulsos"
                count={avulsos.length}
                onVerTodos={() => navigate('/admin/jogadores/avulso')}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {avulsos.slice(0, 2).map(p => (
                  <PlayerRow key={p.id} player={p} onClick={() => navigate(`/admin/jogador/${p.id}`)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Botão fixo Enviar Notificação */}
      <div style={{
        position: 'fixed',
        bottom: 'calc(var(--bottom-nav-height) + env(safe-area-inset-bottom) + 16px)',
        left: 24, right: 24, zIndex: 49
      }}>
        <button onClick={() => { setShowNotifSheet(true); setShowAddSheet(false) }}
          className="w-full transition-all active:scale-95"
          style={{
            background: 'var(--color-surface-accent-light)',
            borderRadius: 'var(--radius-pill)', border: 'none', cursor: 'pointer',
            padding: '16px 24px',
            fontFamily: 'var(--font-primary)', fontWeight: 500,
            fontSize: 'var(--font-size-16)', color: 'var(--color-fg-accent)'
          }}>
          Enviar Notificação
        </button>
      </div>

      {/* Bottom sheet: Enviar Notificação */}
      {showNotifSheet && (
        <>
          <div onClick={() => setShowNotifSheet(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 60 }} />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 70,
            background: 'var(--color-bg)', borderRadius: '24px 24px 0 0',
            padding: '24px 24px 40px', display: 'flex', flexDirection: 'column', gap: 16
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 600, fontSize: 'var(--font-size-16)', color: 'var(--color-fg-primary)' }}>
                Enviar Notificação
              </p>
              <button onClick={() => setShowNotifSheet(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                <X size={20} color="var(--color-fg-secondary)" />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {([
                ['presenca', 'Confirmar presença', 'Para quem ainda não respondeu esta quarta'],
                ['cobranca', 'Cobrar mensalidade/avulso', 'Para quem ainda não pagou este mês'],
              ] as const).map(([type, label, desc]) => (
                <button key={type} onClick={() => setNotifType(type)}
                  className="flex items-start gap-3 p-3 rounded-2xl text-left transition-all"
                  style={{
                    background: notifType === type ? 'var(--color-surface-accent-light)' : 'var(--color-surface-primary)',
                    border: notifType === type ? '1.5px solid var(--color-fg-accent)' : '1.5px solid transparent',
                    cursor: 'pointer'
                  }}>
                  <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5"
                    style={{
                      borderColor: notifType === type ? 'var(--color-fg-accent)' : 'var(--color-fg-secondary)',
                      background: notifType === type ? 'var(--color-fg-accent)' : 'transparent'
                    }}>
                    {notifType === type && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                  <div>
                    <p style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-14)', fontWeight: 500 }}>{label}</p>
                    <p style={{ color: 'var(--color-fg-secondary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-12)' }}>{desc}</p>
                  </div>
                </button>
              ))}
            </div>

            <input type="text" placeholder="Mensagem personalizada (opcional)"
              value={notifMessage} onChange={e => setNotifMessage(e.target.value)} style={inputStyle} />

            <button onClick={() => sendNotification.mutate()} disabled={sendNotification.isPending}
              className="w-full transition-all active:scale-95 disabled:opacity-40 flex items-center justify-center gap-2"
              style={{
                background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-fg)',
                borderRadius: 'var(--radius-pill)', border: 'none', cursor: 'pointer',
                padding: '16px 24px', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)'
              }}>
              <Bell size={18} />
              {sendNotification.isPending ? 'Enviando...' : 'Enviar'}
            </button>
          </div>
        </>
      )}

      {/* Bottom sheet: Adicionar Jogador */}
      {showAddSheet && (
        <>
          <div onClick={() => setShowAddSheet(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 60 }} />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 70,
            background: 'var(--color-bg)', borderRadius: '24px 24px 0 0',
            padding: '24px 24px 40px', display: 'flex', flexDirection: 'column', gap: 12
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 600, fontSize: 'var(--font-size-16)', color: 'var(--color-fg-primary)' }}>
                Novo Jogador
              </p>
              <button onClick={() => setShowAddSheet(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                <X size={20} color="var(--color-fg-secondary)" />
              </button>
            </div>
            <input type="text" placeholder="Nome" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} />
            <input type="email" placeholder="Email" value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={inputStyle} />
            <input type="text" placeholder="Senha inicial" value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))} style={inputStyle} />
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
            <button onClick={() => createPlayer.mutate()}
              disabled={createPlayer.isPending || !form.name || !form.email || !form.password}
              className="w-full transition-all active:scale-95 disabled:opacity-40"
              style={{
                background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-fg)',
                borderRadius: 'var(--radius-pill)', border: 'none', cursor: 'pointer',
                padding: '16px 24px', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)'
              }}>
              {createPlayer.isPending ? 'Criando...' : 'Adicionar jogador'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

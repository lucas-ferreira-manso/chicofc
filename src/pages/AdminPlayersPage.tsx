import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { doc, setDoc } from 'firebase/firestore'
import { createUserWithEmailAndPassword, getAuth } from 'firebase/auth'
import { initializeApp, deleteApp } from 'firebase/app'
import { db, firebaseConfig } from '../lib/firebase'
import { useAuthStore } from '../store/authStore'
import { toast } from 'sonner'
import { CaretLeft, UserPlus, X } from '@phosphor-icons/react'
import { fetchPlayers } from './AdminPage'
import type { Profile } from '../types'

const auth = getAuth()

function getInitials(name: string): string {
  return name.trim().split(' ').filter(Boolean).slice(0, 2).map(n => n[0].toUpperCase()).join('')
}

function isChinelinho(player: Profile): boolean {
  return !!((player as any).chinelinhoActive && (!(player as any).chinelinhoUntil || new Date((player as any).chinelinhoUntil) > new Date()))
}

function PlayerRow({ player, onClick }: { player: Profile; onClick: () => void }) {
  const chinelinho = isChinelinho(player)
  return (
    <button onClick={onClick} style={{
      width: '100%', background: 'var(--color-surface-primary)',
      border: 'none', cursor: 'pointer', padding: 16, borderRadius: 24,
      height: 64, display: 'flex', alignItems: 'center', gap: 8
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
        background: 'var(--color-avatar-bg)', overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        {player.photoURL ? (
          <img src={player.photoURL} alt={player.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ fontFamily: 'var(--font-primary)', fontWeight: 500, fontSize: 'var(--font-size-14)', color: 'var(--color-avatar-fg)' }}>
            {getInitials(player.name)}
          </span>
        )}
      </div>
      <p style={{
        flex: 1, fontFamily: 'var(--font-primary)', fontWeight: 500,
        fontSize: 'var(--font-size-16)', color: 'var(--color-fg-primary)',
        textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
      }}>
        {player.name}
      </p>
      {chinelinho && (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          height: 24, padding: '1px 8px',
          background: 'var(--color-surface-secondary)',
          border: '1px solid var(--color-border)',
          borderRadius: 16, flexShrink: 0, whiteSpace: 'nowrap'
        }}>
          <span style={{ fontFamily: 'var(--font-primary)', fontSize: 11, fontWeight: 400, color: 'var(--color-fg-primary)', lineHeight: 1 }}>
            Modo Chinelinho
          </span>
          <span style={{ fontSize: 13, lineHeight: 1 }}>🩴</span>
        </span>
      )}
    </button>
  )
}

const inputStyle: React.CSSProperties = {
  background: 'var(--color-surface-secondary)',
  borderRadius: 'var(--radius-pill)', border: 'none', outline: 'none',
  padding: '12px 20px', fontFamily: 'var(--font-primary)',
  fontSize: 'var(--font-size-16)', color: 'var(--color-fg-primary)', width: '100%'
}

export default function AdminPlayersPage() {
  const { type } = useParams<{ type: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const user = useAuthStore(s => s.user)

  const [showAddSheet, setShowAddSheet] = useState(false)
  const [form, setForm] = useState({
    name: '', email: '', password: '',
    player_type: (type ?? 'mensalista') as 'mensalista' | 'avulso',
    role: 'player' as 'admin' | 'player'
  })

  const { data: players = [], isLoading } = useQuery({ queryKey: ['players'], queryFn: fetchPlayers })
  const filtered = players.filter(p => p.active && p.player_type === type)

  const title = type === 'mensalista' ? 'Lista Mensalistas' : 'Lista Avulsos'

  const createPlayer = useMutation({
    mutationFn: async () => {
      // Usa app secundário para criar o usuário sem interromper a sessão do admin
      const secondaryApp = initializeApp(firebaseConfig, `create-user-${Date.now()}`)
      const secondaryAuth = getAuth(secondaryApp)
      try {
        const result = await createUserWithEmailAndPassword(secondaryAuth, form.email, form.password)
        await setDoc(doc(db, 'players', result.user.uid), {
          name: form.name, email: form.email.toLowerCase(),
          player_type: form.player_type, role: form.role,
          active: true, created_at: new Date().toISOString()
        })
      } finally {
        await deleteApp(secondaryApp)
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['players'] })
      toast.success(`${form.name} adicionado!`)
      setForm({ name: '', email: '', password: '', player_type: (type ?? 'mensalista') as any, role: 'player' })
      setShowAddSheet(false)
    },
    onError: (e: any) => {
      toast.error(e.code === 'auth/email-already-in-use' ? 'Email já cadastrado.' : 'Erro ao adicionar.')
    }
  })

  return (
    <div className="flex flex-col min-h-screen" style={{ background: 'var(--color-bg)', paddingBottom: 'calc(120px + env(safe-area-inset-bottom))' }}>
      {/* Header */}
      <div className="fixed top-0 inset-x-0 z-40"
        style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
        <div className="flex items-center gap-2 px-6 py-4">
          <button onClick={() => navigate(-1)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}>
            <CaretLeft size={24} color="var(--color-fg-primary)" />
          </button>
          <p style={{
            flex: 1, fontFamily: 'var(--font-primary)', fontWeight: 600,
            fontSize: 'var(--font-size-24)', lineHeight: '28px', color: 'var(--color-fg-primary)'
          }}>
            {title}
          </p>
          <button onClick={() => setShowAddSheet(true)}
            className="w-8 h-8 flex items-center justify-center rounded-full transition-all active:scale-95"
            style={{ background: 'var(--btn-primary-bg)', border: 'none', cursor: 'pointer' }}>
            <UserPlus size={18} color="var(--btn-primary-fg)" />
          </button>
        </div>
      </div>
      <div style={{ height: 80 }} />

      {isLoading ? (
        <div className="flex justify-center py-8"><div className="text-4xl animate-spin">⚽</div></div>
      ) : filtered.length === 0 ? (
        <p style={{ textAlign: 'center', padding: '48px 24px', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)', color: 'var(--color-fg-secondary)' }}>
          Nenhum jogador encontrado.
        </p>
      ) : (
        <div className="px-6" style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 8 }}>
          {filtered.map(p => (
            <PlayerRow key={p.id} player={p} onClick={() => navigate(`/admin/jogador/${p.id}`)} />
          ))}
        </div>
      )}

      {/* Bottom sheet: Adicionar Jogador */}
      {showAddSheet && (
        <>
          <div onClick={() => setShowAddSheet(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 40 }} />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
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

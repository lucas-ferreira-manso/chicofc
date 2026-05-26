import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { doc, updateDoc } from 'firebase/firestore'
import { getAuth, getIdToken } from 'firebase/auth'
import { db } from '../lib/firebase'
import { toast } from 'sonner'
import { CaretLeft, TrashSimple, CaretDown, X } from '@phosphor-icons/react'
import Toggle from '../components/Toggle'
import ChinelinhoSheet from '../components/ChinelinhoSheet'
import { fetchPlayers } from './AdminPage'

const auth = getAuth()
const SERVER_URL = 'https://chicofc-server.onrender.com'

function getInitials(name: string): string {
  return name.trim().split(' ').filter(Boolean).slice(0, 2).map(n => n[0].toUpperCase()).join('')
}

export default function AdminPlayerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [showDeleteSheet, setShowDeleteSheet] = useState(false)
  const [showTypeDropdown, setShowTypeDropdown] = useState(false)
  const [showChinelinhoSheet, setShowChinelinhoSheet] = useState(false)

  const { data: players = [] } = useQuery({ queryKey: ['players'], queryFn: fetchPlayers })
  const player = players.find(p => p.id === id)

  const updateType = useMutation({
    mutationFn: async (type: 'mensalista' | 'avulso') => {
      await updateDoc(doc(db, 'players', id!), { player_type: type })
      // Se mudar para avulso, remove admin
      if (type === 'avulso') {
        await updateDoc(doc(db, 'players', id!), { role: 'player' })
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['players'] })
      toast.success('Tipo atualizado!')
      setShowTypeDropdown(false)
    },
    onError: () => toast.error('Erro ao atualizar tipo.')
  })

  const updateRole = useMutation({
    mutationFn: async (isAdmin: boolean) => {
      await updateDoc(doc(db, 'players', id!), { role: isAdmin ? 'admin' : 'player' })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['players'] })
      toast.success('Função atualizada!')
    },
    onError: () => toast.error('Erro ao atualizar função.')
  })

  const deactivatePlayer = useMutation({
    mutationFn: async () => {
      await updateDoc(doc(db, 'players', id!), { active: false })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['players'] })
      toast.success('Jogador removido.')
      navigate(-1)
    },
    onError: () => toast.error('Erro ao remover jogador.')
  })

  const cobrar = useMutation({
    mutationFn: async () => {
      const currentUser = auth.currentUser
      if (!currentUser) throw new Error('Não autenticado')
      const token = await getIdToken(currentUser)
      const isMens = player?.player_type === 'mensalista'
      const message = isMens
        ? 'Você ainda tem mensalidade pendente. Por favor, efetue o pagamento!'
        : 'Você ainda tem pagamento de jogo pendente. Por favor, efetue o pagamento!'
      const res = await fetch(`${SERVER_URL}/notify-cobranca`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ userId: player?.id, message })
      })
      if (!res.ok) throw new Error('Erro no servidor')
      return res.json()
    },
    onSuccess: () => toast.success('Cobrança enviada!'),
    onError: (e: any) => toast.error(`Erro: ${e.message}`)
  })

  const updateChinelinho = useMutation({
    mutationFn: async ({ active, until }: { active: boolean; until: string | null }) => {
      await updateDoc(doc(db, 'players', id!), { chinelinhoActive: active, chinelinhoUntil: until })
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['players'] })
      if (vars.active) {
        const msg = vars.until
          ? `Chinelinho ativado até ${new Date(vars.until).toLocaleDateString('pt-BR')} 🩴`
          : 'Chinelinho ativado indefinidamente 🩴'
        toast(msg)
      } else {
        toast.success('Modo Chinelinho desativado 🏃')
      }
      setShowChinelinhoSheet(false)
    },
    onError: () => toast.error('Erro ao atualizar Modo Chinelinho.')
  })

  if (!player) return (
    <div className="flex flex-col min-h-full" style={{ background: 'var(--color-bg)' }}>
      <div style={{ height: 80 }} />
      <p style={{ textAlign: 'center', padding: 48, fontFamily: 'var(--font-primary)', color: 'var(--color-fg-secondary)' }}>
        Jogador não encontrado.
      </p>
    </div>
  )

  const isAdmin = player.role === 'admin'
  const isMensalista = player.player_type === 'mensalista'
  const isChinelinhoActive = !!(
    (player as any).chinelinhoActive &&
    (!(player as any).chinelinhoUntil || new Date((player as any).chinelinhoUntil) > new Date())
  )

  return (
    <div className="flex flex-col min-h-full" style={{ background: 'var(--color-bg)', paddingBottom: 40 }}>
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
            Detalhe Jogador
          </p>
          <button onClick={() => setShowDeleteSheet(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}>
            <TrashSimple size={24} color="var(--color-danger)" />
          </button>
        </div>
      </div>
      <div style={{ height: 80 }} />

      <div className="px-6" style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 8 }}>
        {/* Top card: avatar + nome + tags */}
        <div style={{
          background: 'var(--color-surface-primary)', borderRadius: 16,
          padding: 20, display: 'flex', gap: 16, alignItems: 'center'
        }}>
          {/* Avatar 80px */}
          <div style={{
            width: 80, height: 80, borderRadius: '50%', flexShrink: 0,
            background: 'var(--color-avatar-bg)', overflow: 'hidden',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            {player.photoURL ? (
              <img src={player.photoURL} alt={player.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{
                fontFamily: 'var(--font-primary)', fontWeight: 700,
                fontSize: 26, color: 'var(--color-avatar-fg)'
              }}>
                {getInitials(player.name)}
              </span>
            )}
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{
              fontFamily: 'var(--font-primary)', fontWeight: 500,
              fontSize: 'var(--font-size-18)', color: 'var(--color-fg-primary)', whiteSpace: 'nowrap'
            }}>
              {player.name}
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {/* Tag tipo */}
              <span style={{
                background: 'var(--color-surface-accent-light)',
                color: 'var(--color-fg-accent)',
                fontFamily: 'var(--font-primary)', fontWeight: 600, fontSize: 'var(--font-size-12)',
                padding: '6px 12px', borderRadius: 9999
              }}>
                {isMensalista ? 'Mensalista' : 'Avulso'}
              </span>
              {/* Tag admin */}
              {isAdmin && (
                <span style={{
                  background: '#a8ffbb', color: '#089527',
                  fontFamily: 'var(--font-primary)', fontWeight: 600, fontSize: 'var(--font-size-12)',
                  padding: '6px 12px', borderRadius: 9999
                }}>
                  Admin
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Select tipo: Mensalista / Avulso */}
        <div style={{ position: 'relative' }}>
          <button onClick={() => setShowTypeDropdown(v => !v)}
            style={{
              width: '100%', background: 'var(--color-surface-primary)', border: 'none', cursor: 'pointer',
              padding: '0 16px', borderRadius: 24, height: 64,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
            <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 500, fontSize: 'var(--font-size-14)', color: 'var(--color-fg-primary)' }}>
              {isMensalista ? 'Mensalista' : 'Avulso'}
            </p>
            <CaretDown size={20} color="var(--color-fg-secondary)"
              style={{ transform: showTypeDropdown ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
          </button>

          {showTypeDropdown && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, marginTop: 4,
              background: 'var(--color-surface-primary)', borderRadius: 16,
              overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,0.12)'
            }}>
              {(['mensalista', 'avulso'] as const).map(t => (
                <button key={t} onClick={() => updateType.mutate(t)}
                  disabled={updateType.isPending}
                  style={{
                    width: '100%', background: player.player_type === t ? 'var(--color-surface-accent-light)' : 'transparent',
                    border: 'none', cursor: 'pointer', padding: '14px 16px', textAlign: 'left',
                    fontFamily: 'var(--font-primary)', fontWeight: 500, fontSize: 'var(--font-size-14)',
                    color: player.player_type === t ? 'var(--color-fg-accent)' : 'var(--color-fg-primary)'
                  }}>
                  {t === 'mensalista' ? 'Mensalista' : 'Avulso'}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Toggle Admin — apenas para mensalistas */}
        {isMensalista && (
          <div style={{
            background: 'var(--color-surface-primary)', borderRadius: 24, height: 64,
            padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
          }}>
            <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 500, fontSize: 'var(--font-size-14)', color: 'var(--color-fg-primary)' }}>
              Admin
            </p>
            <Toggle
              active={isAdmin}
              onChange={v => updateRole.mutate(v)}
              disabled={updateRole.isPending}
            />
          </div>
        )}

        {/* Toggle Modo Chinelinho */}
        <div style={{
          background: 'var(--color-surface-primary)', borderRadius: 24, height: 64,
          padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 500, fontSize: 'var(--font-size-14)', color: 'var(--color-fg-primary)' }}>
              Modo Chinelinho 🩴
            </p>
            {isChinelinhoActive && (player as any).chinelinhoUntil && (
              <p style={{ fontFamily: 'var(--font-primary)', fontSize: 11, color: 'var(--color-fg-secondary)' }}>
                até {new Date((player as any).chinelinhoUntil).toLocaleDateString('pt-BR')}
              </p>
            )}
            {isChinelinhoActive && !(player as any).chinelinhoUntil && (
              <p style={{ fontFamily: 'var(--font-primary)', fontSize: 11, color: 'var(--color-fg-secondary)' }}>
                desativação manual
              </p>
            )}
          </div>
          <Toggle
            active={isChinelinhoActive}
            onChange={v => {
              if (v) setShowChinelinhoSheet(true)
              else updateChinelinho.mutate({ active: false, until: null })
            }}
            disabled={updateChinelinho.isPending}
          />
        </div>

        {/* Botão Cobrar */}
        <div style={{ marginTop: 'auto', paddingTop: 24 }}>
          <button
            onClick={() => cobrar.mutate()}
            disabled={cobrar.isPending}
            className="w-full transition-all active:scale-95 disabled:opacity-40"
            style={{
              background: 'var(--color-surface-accent-light)',
              border: 'none', cursor: 'pointer', borderRadius: 'var(--radius-pill)',
              padding: '16px 24px',
              fontFamily: 'var(--font-primary)', fontWeight: 500,
              fontSize: 'var(--font-size-16)', color: 'var(--color-fg-accent)'
            }}>
            {cobrar.isPending ? 'Enviando...' : isMensalista ? 'Cobrar Mensalidade' : 'Cobrar Jogo'}
          </button>
        </div>
      </div>

      {/* Bottom sheet: Modo Chinelinho */}
      {showChinelinhoSheet && (
        <ChinelinhoSheet
          onClose={() => setShowChinelinhoSheet(false)}
          onActivate={async (until) => {
            updateChinelinho.mutate({ active: true, until })
          }}
        />
      )}

      {/* Bottom sheet: Confirmar exclusão */}
      {showDeleteSheet && (
        <>
          <div onClick={() => setShowDeleteSheet(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 40 }} />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
            background: 'var(--color-bg)', borderRadius: '24px 24px 0 0',
            padding: '24px 24px 40px', display: 'flex', flexDirection: 'column', gap: 16
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 600, fontSize: 'var(--font-size-16)', color: 'var(--color-fg-primary)' }}>
                Excluir Jogador
              </p>
              <button onClick={() => setShowDeleteSheet(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                <X size={20} color="var(--color-fg-secondary)" />
              </button>
            </div>

            <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 600, fontSize: 'var(--font-size-16)', color: 'var(--color-fg-primary)' }}>
              Você deseja mesmo excluir {player.name} do seu time?
            </p>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowDeleteSheet(false)}
                style={{
                  flex: 1, background: 'var(--color-surface-accent-light)', border: 'none', cursor: 'pointer',
                  borderRadius: 'var(--radius-pill)', padding: '16px 24px',
                  fontFamily: 'var(--font-primary)', fontWeight: 500,
                  fontSize: 'var(--font-size-16)', color: 'var(--color-fg-accent)'
                }}>
                Cancelar
              </button>
              <button onClick={() => deactivatePlayer.mutate()}
                disabled={deactivatePlayer.isPending}
                className="transition-all active:scale-95 disabled:opacity-40"
                style={{
                  flex: 1, background: 'var(--btn-primary-bg)', border: 'none', cursor: 'pointer',
                  borderRadius: 'var(--radius-pill)', padding: '16px 24px',
                  fontFamily: 'var(--font-primary)', fontWeight: 500,
                  fontSize: 'var(--font-size-16)', color: 'var(--btn-primary-fg)'
                }}>
                {deactivatePlayer.isPending ? 'Removendo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

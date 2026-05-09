import { useState } from 'react'
import Header from '../components/layout/Header'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  doc, getDoc, setDoc, collection, query, where, getDocs
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuthStore } from '../store/authStore'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { X, TrashSimple } from '@phosphor-icons/react'
import { toast } from 'sonner'

// ─── Types ────────────────────────────────────────────────────────────────────

interface GameEntry { blue: number; yellow: number; date: string }
interface ScoreData {
  blueWins: number; yellowWins: number; updatedAt: string; history: GameEntry[]
}
const EMPTY_SCORE: ScoreData = { blueWins: 0, yellowWins: 0, updatedAt: '', history: [] }

interface PlayerInfo { id: string; name: string; photoURL?: string }
interface VotacaoData {
  votos: Record<string, { bolaCheia: string; bolaMurcha: string }>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getLastWednesdayId(): string {
  const today = new Date()
  const daysBack = (today.getDay() - 3 + 7) % 7
  const d = new Date(today)
  d.setDate(today.getDate() - daysBack)
  return format(d, 'yyyy-MM-dd')
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
}

function computeWinner(
  votos: Record<string, { bolaCheia: string; bolaMurcha: string }>,
  type: 'bolaCheia' | 'bolaMurcha'
): string | null {
  const counts: Record<string, number> = {}
  Object.values(votos).forEach(v => {
    const id = v[type]
    if (id) counts[id] = (counts[id] || 0) + 1
  })
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
}

// ─── Data Fetching ─────────────────────────────────────────────────────────────

async function fetchScore(): Promise<ScoreData> {
  const snap = await getDoc(doc(db, 'config', 'score'))
  if (!snap.exists()) return EMPTY_SCORE
  const data = snap.data()
  return {
    blueWins: data.blueWins ?? 0,
    yellowWins: data.yellowWins ?? 0,
    updatedAt: data.updatedAt ?? '',
    history: data.history ?? []
  }
}

async function fetchConfirmedPlayers(gameId: string): Promise<PlayerInfo[]> {
  const q = query(
    collection(db, 'attendances'),
    where('game_id', '==', gameId),
    where('status', '==', 'confirmed')
  )
  const snap = await getDocs(q)
  const userIds = [...new Set(snap.docs.map(d => d.data().user_id as string))]
  const profiles = await Promise.all(
    userIds.map(async id => {
      const pSnap = await getDoc(doc(db, 'players', id))
      if (!pSnap.exists()) return null
      const data = pSnap.data()
      return { id, name: data.name || data.email || 'Jogador', photoURL: data.photoURL } as PlayerInfo
    })
  )
  return profiles.filter(Boolean) as PlayerInfo[]
}

async function fetchVotacao(gameId: string): Promise<VotacaoData> {
  const snap = await getDoc(doc(db, 'votacao', gameId))
  if (!snap.exists()) return { votos: {} }
  return { votos: snap.data().votos ?? {} }
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────

function BolaCheiaIcon({ size = 52 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 52 52" fill="none">
      <circle cx="26" cy="26" r="23" fill="#082996" />
      <circle cx="26" cy="26" r="22.5" stroke="white" strokeWidth="1" fill="none" />
      {/* centro pentágono */}
      <path d="M26 15 L30.5 19 L28.5 25 L23.5 25 L21.5 19 Z"
        fill="none" stroke="white" strokeWidth="1.2" />
      {/* conexões topo */}
      <path d="M26 15 L23 9.5 M26 15 L29 9.5" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
      {/* lado direito */}
      <path d="M30.5 19 L37 17 M28.5 25 L35.5 26 L36.5 33 L30.5 36 L26 32"
        stroke="white" strokeWidth="1.2" fill="none" strokeLinejoin="round" />
      {/* lado esquerdo */}
      <path d="M21.5 19 L15 17 M23.5 25 L16.5 26 L15.5 33 L21.5 36 L26 32"
        stroke="white" strokeWidth="1.2" fill="none" strokeLinejoin="round" />
      {/* base */}
      <path d="M26 32 L29 38 L26 42 L23 38 Z"
        fill="none" stroke="white" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  )
}

function BolaMurchaIcon({ size = 52 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 52 52" fill="none">
      <ellipse cx="26" cy="35" rx="20" ry="9" fill="#ed0000" />
      <path d="M6 33 Q14 26 26 30.5 Q38 35 46 28"
        stroke="white" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      <path d="M10 39 Q18 36 26 38 Q34 40 42 37"
        stroke="rgba(255,255,255,0.45)" strokeWidth="1" fill="none" strokeLinecap="round" />
      <ellipse cx="26" cy="35" rx="20" ry="9"
        stroke="white" strokeWidth="1.2" fill="none" />
    </svg>
  )
}

// ─── Player Avatar ─────────────────────────────────────────────────────────────

function PlayerAvatar({ player, size = 32 }: { player: PlayerInfo; size?: number }) {
  const initials = getInitials(player.name)
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'var(--color-avatar-bg)', overflow: 'hidden',
      flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      {player.photoURL ? (
        <img src={player.photoURL} alt={player.name}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <span style={{
          color: 'var(--color-avatar-fg)', fontFamily: 'var(--font-primary)',
          fontSize: size * 0.38, fontWeight: 600
        }}>
          {initials}
        </span>
      )}
    </div>
  )
}

// ─── Badge Votação ─────────────────────────────────────────────────────────────

interface BadgeProps {
  type: 'bolaCheia' | 'bolaMurcha'
  player?: PlayerInfo | null
  onClick?: () => void
  disabled?: boolean
}

function BadgeVotacao({ type, player, onClick, disabled }: BadgeProps) {
  const isMurcha = type === 'bolaMurcha'
  const accentColor = isMurcha ? '#ed0000' : '#082996'
  const label = isMurcha ? 'Bola Murcha' : 'Bola Cheia'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 133, position: 'relative' }}>
      {/* Área da foto/placeholder */}
      <button
        onClick={onClick}
        disabled={disabled || !onClick}
        style={{
          height: 150, borderRadius: 24, width: '100%',
          background: player ? 'var(--color-surface-secondary)' : 'white',
          border: player ? 'none' : '1.5px solid var(--color-border)',
          overflow: 'hidden', position: 'relative',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: (disabled || !onClick) ? 'default' : 'pointer',
          padding: 0
        }}>
        {player ? (
          player.photoURL ? (
            <img
              src={player.photoURL} alt={player.name}
              style={{
                position: 'absolute', top: -6, left: -14,
                width: 157, height: 157, objectFit: 'cover',
                pointerEvents: 'none'
              }}
            />
          ) : (
            <span style={{
              fontFamily: 'var(--font-primary)', fontWeight: 700,
              fontSize: 48, color: accentColor, opacity: 0.25
            }}>
              {getInitials(player.name)}
            </span>
          )
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M12 5V19M5 12H19" stroke={accentColor}
              strokeWidth="2" strokeLinecap="round" />
          </svg>
        )}
      </button>

      {/* Texto */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{
          fontFamily: 'var(--font-primary)', fontWeight: 700,
          fontSize: 18, lineHeight: '18px', color: accentColor
        }}>
          {label}
        </span>
        <span style={{
          fontFamily: 'var(--font-primary)', fontWeight: 500,
          fontSize: 14, color: 'var(--color-fg-secondary)'
        }}>
          {player ? player.name : 'nome atleta'}
        </span>
      </div>

      {/* Ícone da bola sobreposto */}
      <div style={{ position: 'absolute', right: -3, top: 118, pointerEvents: 'none' }}>
        {isMurcha ? <BolaMurchaIcon size={52} /> : <BolaCheiaIcon size={52} />}
      </div>
    </div>
  )
}

// ─── Voting Bottom Sheet ───────────────────────────────────────────────────────

interface VotingSheetProps {
  type: 'bolaCheia' | 'bolaMurcha'
  players: PlayerInfo[]
  onClose: () => void
  onVote: (playerId: string) => void
}

function VotingSheet({ type, players, onClose, onVote }: VotingSheetProps) {
  const [selected, setSelected] = useState<string | null>(null)
  const isMurcha = type === 'bolaMurcha'
  const title = isMurcha ? 'Vote no Bola Murcha' : 'Vote no Bola Cheia'
  const accentColor = isMurcha ? '#ed0000' : '#082996'

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'flex-end'
      }}
      onClick={onClose}>
      <div
        style={{
          width: '100%', background: 'white',
          borderRadius: '24px 24px 0 0',
          padding: '24px 24px 40px',
          maxHeight: '82vh',
          display: 'flex', flexDirection: 'column', gap: 24
        }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{
            fontFamily: 'var(--font-primary)', fontWeight: 600,
            fontSize: 16, color: 'var(--color-fg-primary)'
          }}>
            {title}
          </span>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: 16,
              background: 'var(--color-surface-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: 'none', cursor: 'pointer', flexShrink: 0
            }}>
            <X size={16} color="var(--color-fg-secondary)" />
          </button>
        </div>

        {/* Lista de jogadores */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 8,
          overflowY: 'auto', flex: 1
        }}>
          {players.length === 0 && (
            <p style={{
              textAlign: 'center', padding: '24px 0',
              fontFamily: 'var(--font-primary)', fontSize: 14,
              color: 'var(--color-fg-secondary)'
            }}>
              Nenhum jogador disponível
            </p>
          )}
          {players.map(player => (
            <button
              key={player.id}
              onClick={() => setSelected(player.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: 16, borderRadius: 24, width: '100%',
                background: 'var(--color-surface-primary)',
                border: selected === player.id
                  ? `2px solid ${accentColor}`
                  : '2px solid transparent',
                cursor: 'pointer',
                transition: 'border-color 0.15s'
              }}>
              <PlayerAvatar player={player} size={32} />
              <span style={{
                fontFamily: 'var(--font-primary)', fontWeight: 500,
                fontSize: 16, color: 'var(--color-fg-primary)'
              }}>
                {player.name}
              </span>
            </button>
          ))}
        </div>

        {/* Botão Votar */}
        <button
          onClick={() => selected && onVote(selected)}
          disabled={!selected}
          style={{
            width: '100%', height: 56, borderRadius: 9999,
            background: selected ? accentColor : 'var(--color-surface-secondary)',
            color: selected ? 'white' : 'var(--color-fg-secondary)',
            fontFamily: 'var(--font-primary)', fontWeight: 500, fontSize: 16,
            border: 'none', cursor: selected ? 'pointer' : 'default',
            flexShrink: 0, transition: 'background 0.15s, color 0.15s'
          }}>
          Votar
        </button>
      </div>
    </div>
  )
}

// ─── Aba Jogador ───────────────────────────────────────────────────────────────

function JogadorTab() {
  const user = useAuthStore(s => s.user)
  const gameId = getLastWednesdayId()
  const qc = useQueryClient()

  const [sheetType, setSheetType] = useState<'bolaCheia' | 'bolaMurcha' | null>(null)
  const [pendingCheia, setPendingCheia] = useState<string | null>(null)
  const [pendingMurcha, setPendingMurcha] = useState<string | null>(null)

  const { data: players = [], isLoading: loadingPlayers } = useQuery({
    queryKey: ['confirmed-players', gameId],
    queryFn: () => fetchConfirmedPlayers(gameId),
    refetchInterval: 30_000
  })

  const { data: votacao, isLoading: loadingVotacao } = useQuery({
    queryKey: ['votacao', gameId],
    queryFn: () => fetchVotacao(gameId),
    refetchInterval: 10_000
  })

  const saveVote = useMutation({
    mutationFn: async (votes: { bolaCheia: string; bolaMurcha: string }) => {
      const current = votacao ?? { votos: {} }
      await setDoc(doc(db, 'votacao', gameId), {
        votos: { ...current.votos, [user!.id]: votes }
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['votacao', gameId] })
      toast.success('Voto registrado!')
    },
    onError: () => toast.error('Erro ao votar. Tente novamente.')
  })

  const handleSelectVote = (type: 'bolaCheia' | 'bolaMurcha', playerId: string) => {
    if (type === 'bolaCheia') setPendingCheia(playerId)
    else setPendingMurcha(playerId)
    setSheetType(null)
  }

  const handleShare = async () => {
    const cheiaId = votacao ? computeWinner(votacao.votos, 'bolaCheia') : null
    const murchaId = votacao ? computeWinner(votacao.votos, 'bolaMurcha') : null
    const cheiaName = players.find(p => p.id === cheiaId)?.name ?? '?'
    const murchaName = players.find(p => p.id === murchaId)?.name ?? '?'
    const text = `⚽ Bola Cheia: ${cheiaName}\n🫨 Bola Murcha: ${murchaName}\n#ChicoFC`
    if (navigator.share) {
      try { await navigator.share({ text }) } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(text)
      toast.success('Copiado para a área de transferência!')
    }
  }

  if (loadingPlayers || loadingVotacao) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
        <div className="text-4xl animate-spin">⚽</div>
      </div>
    )
  }

  const myVote = votacao?.votos?.[user!.id]
  const hasVoted = !!myVote
  const userWasConfirmed = players.some(p => p.id === user!.id)

  // Vencedores calculados por pluralidade
  const cheiaWinnerId = votacao ? computeWinner(votacao.votos, 'bolaCheia') : null
  const murchaWinnerId = votacao ? computeWinner(votacao.votos, 'bolaMurcha') : null
  const cheiaWinner = players.find(p => p.id === cheiaWinnerId) ?? null
  const murchaWinner = players.find(p => p.id === murchaWinnerId) ?? null

  // Seleções locais pendentes
  const pendingCheiaPlayer = players.find(p => p.id === pendingCheia) ?? null
  const pendingMurchaPlayer = players.find(p => p.id === pendingMurcha) ?? null
  const bothSelected = pendingCheia !== null && pendingMurcha !== null

  // Jogadores votáveis (sem o próprio usuário, sem o já selecionado no outro tipo)
  const votableForCheia = players.filter(p => p.id !== user!.id && p.id !== pendingMurcha)
  const votableForMurcha = players.filter(p => p.id !== user!.id && p.id !== pendingCheia)

  // ── Estado: usuário já votou ──────────────────────────────────────────────
  if (hasVoted) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 10,
        padding: 16, background: 'var(--color-surface-primary)', borderRadius: 24
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 8 }}>
          <p style={{
            fontFamily: 'var(--font-primary)', fontWeight: 600,
            fontSize: 24, lineHeight: '28px', color: '#082996'
          }}>
            Parabéns aos envolvidos!
          </p>
          <p style={{
            fontFamily: 'var(--font-primary)', fontWeight: 500,
            fontSize: 16, color: 'var(--color-fg-secondary)'
          }}>
            Vocês foram os escolhidos ao bola cheia e bola murcha da rodada!
          </p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 8px' }}>
          <BadgeVotacao type="bolaCheia" player={cheiaWinner} disabled />
          <BadgeVotacao type="bolaMurcha" player={murchaWinner} disabled />
        </div>

        <button
          onClick={handleShare}
          style={{
            width: '100%', height: 56, borderRadius: 9999,
            background: 'transparent', border: '2px solid #082996',
            color: '#082996', fontFamily: 'var(--font-primary)',
            fontWeight: 500, fontSize: 16, cursor: 'pointer'
          }}>
          Compartilhar
        </button>
      </div>
    )
  }

  // ── Estado: usuário não jogou ─────────────────────────────────────────────
  if (!userWasConfirmed) {
    // Se já há votos, exibe o resultado mesmo sem poder votar
    if (cheiaWinnerId || murchaWinnerId) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 10,
          padding: 16, background: 'var(--color-surface-primary)', borderRadius: 24
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 8 }}>
            <p style={{
              fontFamily: 'var(--font-primary)', fontWeight: 600,
              fontSize: 24, lineHeight: '28px', color: '#082996'
            }}>
              Parabéns aos envolvidos!
            </p>
            <p style={{
              fontFamily: 'var(--font-primary)', fontWeight: 500,
              fontSize: 16, color: 'var(--color-fg-secondary)'
            }}>
              Vocês foram os escolhidos ao bola cheia e bola murcha da rodada!
            </p>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 8px' }}>
            <BadgeVotacao type="bolaCheia" player={cheiaWinner} disabled />
            <BadgeVotacao type="bolaMurcha" player={murchaWinner} disabled />
          </div>
        </div>
      )
    }

    return (
      <p style={{
        textAlign: 'center', padding: '32px 0',
        fontFamily: 'var(--font-primary)', fontSize: 16,
        color: 'var(--color-fg-secondary)'
      }}>
        Você não participou deste jogo.
      </p>
    )
  }

  // ── Estado: pré-votação ───────────────────────────────────────────────────
  return (
    <>
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 10,
        padding: 16, background: 'var(--color-surface-primary)', borderRadius: 24
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 8 }}>
          <p style={{
            fontFamily: 'var(--font-primary)', fontWeight: 600,
            fontSize: 24, lineHeight: '28px', color: '#082996'
          }}>
            Chegou a hora de julgar!
          </p>
          <p style={{
            fontFamily: 'var(--font-primary)', fontWeight: 500,
            fontSize: 16, color: 'var(--color-fg-secondary)'
          }}>
            Vote no Bola Cheia e Bola murcha da rodada!
          </p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 8px' }}>
          <BadgeVotacao
            type="bolaCheia"
            player={pendingCheiaPlayer}
            onClick={() => setSheetType('bolaCheia')}
          />
          <BadgeVotacao
            type="bolaMurcha"
            player={pendingMurchaPlayer}
            onClick={() => setSheetType('bolaMurcha')}
          />
        </div>

        {/* Botão confirmar — aparece quando ambos estão selecionados */}
        {bothSelected && (
          <button
            onClick={() => saveVote.mutate({ bolaCheia: pendingCheia!, bolaMurcha: pendingMurcha! })}
            disabled={saveVote.isPending}
            className="transition-all active:scale-95 disabled:opacity-40"
            style={{
              width: '100%', height: 56, borderRadius: 9999,
              background: 'var(--color-surface-accent)', color: 'white',
              fontFamily: 'var(--font-primary)', fontWeight: 500, fontSize: 16,
              border: 'none', cursor: 'pointer'
            }}>
            {saveVote.isPending ? 'Salvando...' : 'Confirmar votos'}
          </button>
        )}
      </div>

      {sheetType && (
        <VotingSheet
          type={sheetType}
          players={sheetType === 'bolaCheia' ? votableForCheia : votableForMurcha}
          onClose={() => setSheetType(null)}
          onVote={(id) => handleSelectVote(sheetType, id)}
        />
      )}
    </>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function StatsPage() {
  const user = useAuthStore(s => s.user)
  const isAdmin = user?.role === 'admin'
  const qc = useQueryClient()

  const [activeTab, setActiveTab] = useState<'placar' | 'jogador'>('placar')
  const [showSheet, setShowSheet] = useState(false)
  const [blueGoals, setBlueGoals] = useState('')
  const [yellowGoals, setYellowGoals] = useState('')

  const { data: score, isLoading } = useQuery({ queryKey: ['score'], queryFn: fetchScore })

  const saveScore = useMutation({
    mutationFn: async () => {
      const blue = parseInt(blueGoals) || 0
      const yellow = parseInt(yellowGoals) || 0
      const now = new Date().toISOString()
      const current = score ?? EMPTY_SCORE
      const newData: ScoreData = {
        blueWins: current.blueWins + (blue > yellow ? 1 : 0),
        yellowWins: current.yellowWins + (yellow > blue ? 1 : 0),
        updatedAt: now,
        history: [...current.history, { blue, yellow, date: now }]
      }
      await setDoc(doc(db, 'config', 'score'), newData)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['score'] })
      toast.success('Placar salvo!')
      setShowSheet(false)
      setBlueGoals('')
      setYellowGoals('')
    },
    onError: () => toast.error('Erro ao salvar placar')
  })

  const deleteEntry = useMutation({
    mutationFn: async (originalIndex: number) => {
      const current = score ?? EMPTY_SCORE
      const newHistory = current.history.filter((_, i) => i !== originalIndex)
      await setDoc(doc(db, 'config', 'score'), {
        ...current,
        blueWins: newHistory.filter(e => e.blue > e.yellow).length,
        yellowWins: newHistory.filter(e => e.yellow > e.blue).length,
        history: newHistory,
        updatedAt: new Date().toISOString()
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['score'] })
      toast.success('Jogo removido!')
    },
    onError: () => toast.error('Erro ao remover jogo')
  })

  const updatedStr = score?.updatedAt
    ? format(new Date(score.updatedAt), "d 'de' MMMM 'às' HH'h'mm", { locale: ptBR })
    : null

  const blueWins = score?.blueWins ?? 0
  const yellowWins = score?.yellowWins ?? 0
  const history = score?.history ?? []

  const gameId = getLastWednesdayId()
  const gameDate = format(new Date(gameId + 'T12:00:00'), "d 'de' MMMM", { locale: ptBR })

  const subtitle = activeTab === 'placar'
    ? (updatedStr ? `Atualizado ${updatedStr}` : 'Nenhuma atualização ainda')
    : `Jogo de ${gameDate}`

  return (
    <div className="flex flex-col min-h-full pb-28" style={{ background: 'var(--color-bg)' }}>
      <Header title="Stats" subtitle={subtitle} />
      <div style={{ height: 96 }} />

      <div className="px-6 flex flex-col gap-4">

        {/* Tabs */}
        <div style={{
          display: 'flex', gap: 16, padding: 8,
          background: 'var(--color-surface-secondary)',
          borderRadius: 20
        }}>
          {(['placar', 'jogador'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1, padding: '8px 20px',
                borderRadius: 16, border: 'none',
                background: activeTab === tab ? 'white' : 'transparent',
                color: 'var(--color-fg-primary)',
                fontFamily: 'var(--font-primary)', fontWeight: 500,
                fontSize: 16, cursor: 'pointer',
                transition: 'background 0.15s',
                boxShadow: activeTab === tab ? '0 1px 4px rgba(0,0,0,0.08)' : 'none'
              }}>
              {tab === 'placar' ? 'Placar' : 'Jogador'}
            </button>
          ))}
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'var(--color-border)' }} />

        {/* ── Aba Placar ── */}
        {activeTab === 'placar' && (
          <>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="text-4xl animate-spin">⚽</div>
              </div>
            ) : (
              <>
                {/* Placar geral */}
                <div className="flex items-center justify-between px-5 py-6 rounded-[20px]"
                  style={{ background: 'var(--color-surface-primary)' }}>
                  <div className="flex flex-col items-center gap-4">
                    <p className="font-bold" style={{
                      color: 'var(--color-fg-primary)',
                      fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-32)'
                    }}>
                      {String(blueWins).padStart(2, '0')}
                    </p>
                    <img src="/team-blue.png" alt="Time Azul" width={126} height={126}
                      style={{ objectFit: 'contain' }} />
                  </div>
                  <p className="font-bold" style={{
                    color: 'var(--color-fg-primary)',
                    fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-32)'
                  }}>x</p>
                  <div className="flex flex-col items-center gap-4">
                    <p className="font-bold" style={{
                      color: 'var(--color-fg-primary)',
                      fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-32)'
                    }}>
                      {String(yellowWins).padStart(2, '0')}
                    </p>
                    <img src="/team-yellow.png" alt="Time Amarelo" width={126} height={126}
                      style={{ objectFit: 'contain' }} />
                  </div>
                </div>

                {/* Divider */}
                <div style={{ height: 1, background: 'var(--color-border)' }} />

                {/* Histórico */}
                {history.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <p className="font-semibold" style={{
                      color: 'var(--color-fg-primary)',
                      fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)'
                    }}>
                      Histórico
                    </p>
                    {[...history].map((entry, i) => ({ entry, originalIndex: i }))
                      .reverse()
                      .map(({ entry, originalIndex }) => {
                        const blueWon = entry.blue > entry.yellow
                        const yellowWon = entry.yellow > entry.blue
                        const dateStr = format(new Date(entry.date), "d MMM", { locale: ptBR })
                        return (
                          <div key={originalIndex}
                            className="flex items-center px-4 py-4 rounded-3xl gap-2"
                            style={{ background: 'var(--color-surface-primary)' }}>
                            <div className="flex items-center gap-2 flex-1">
                              <img src="/team-blue.png" alt="Azul" width={26} height={26}
                                style={{ objectFit: 'contain' }} />
                              <p className="font-medium" style={{
                                color: blueWon ? 'var(--color-fg-accent)' : 'var(--color-fg-secondary)',
                                fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)'
                              }}>
                                {entry.blue}
                              </p>
                            </div>
                            <p style={{
                              color: 'var(--color-fg-secondary)',
                              fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-11)'
                            }}>
                              {dateStr}
                            </p>
                            <div className="flex items-center gap-2 flex-1 justify-end">
                              <p className="font-medium" style={{
                                color: yellowWon ? '#b8860b' : 'var(--color-fg-secondary)',
                                fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)'
                              }}>
                                {entry.yellow}
                              </p>
                              <img src="/team-yellow.png" alt="Amarelo" width={26} height={26}
                                style={{ objectFit: 'contain' }} />
                            </div>
                            {isAdmin && (
                              <button
                                onClick={() => deleteEntry.mutate(originalIndex)}
                                disabled={deleteEntry.isPending}
                                className="ml-1 flex items-center justify-center disabled:opacity-40"
                                style={{ width: 14, height: 14, flexShrink: 0 }}>
                                <TrashSimple size={14} weight="bold" color="var(--color-fg-secondary)" />
                              </button>
                            )}
                          </div>
                        )
                      })}
                  </div>
                )}

                {history.length === 0 && (
                  <p className="text-center py-8" style={{
                    color: 'var(--color-fg-secondary)',
                    fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)'
                  }}>
                    Nenhum jogo registrado ainda
                  </p>
                )}
              </>
            )}
          </>
        )}

        {/* ── Aba Jogador ── */}
        {activeTab === 'jogador' && <JogadorTab />}
      </div>

      {/* Botão fixo Adicionar Placar — só na aba Placar para admins */}
      {activeTab === 'placar' && isAdmin && (
        <div className="fixed inset-x-0 px-6 pt-4 pb-3"
          style={{
            bottom: 'calc(var(--bottom-nav-height) + env(safe-area-inset-bottom))',
            background: 'var(--color-bg)',
            backdropFilter: 'blur(12px)',
            borderTop: '1px solid var(--color-border)'
          }}>
          <button
            onClick={() => setShowSheet(true)}
            className="w-full py-4 font-medium transition-all active:scale-95"
            style={{
              background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-fg)',
              borderRadius: 'var(--radius-pill)',
              fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)'
            }}>
            Adicionar Placar
          </button>
        </div>
      )}

      {/* Bottom Sheet — Adicionar Placar */}
      {showSheet && (
        <div className="fixed inset-0 z-[100] flex items-end"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={() => setShowSheet(false)}>
          <div className="w-full rounded-t-3xl flex flex-col gap-6 pt-6 pb-10 px-6"
            style={{ background: 'var(--color-bg)' }}
            onClick={e => e.stopPropagation()}>

            <div className="flex items-center justify-between">
              <p className="font-semibold" style={{
                color: 'var(--color-fg-primary)',
                fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)'
              }}>
                Adicionar placar
              </p>
              <button onClick={() => setShowSheet(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full"
                style={{ background: 'var(--color-surface-primary)' }}>
                <X size={16} color="var(--color-fg-secondary)" />
              </button>
            </div>

            <div className="flex items-center justify-between px-5 py-6 rounded-[20px]"
              style={{ background: 'var(--color-surface-primary)' }}>
              <div className="flex flex-col items-center gap-4">
                <input type="number" inputMode="numeric" value={blueGoals}
                  onChange={e => setBlueGoals(e.target.value)}
                  placeholder="00" min={0}
                  className="text-center font-bold outline-none w-[82px] rounded-2xl"
                  style={{
                    background: 'white', color: 'var(--color-fg-primary)',
                    fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-32)',
                    padding: '8px 12px', border: '2px solid var(--color-border)'
                  }} />
                <img src="/team-blue.png" alt="Time Azul" width={96} height={96}
                  style={{ objectFit: 'contain' }} />
              </div>
              <p className="font-bold" style={{
                color: 'var(--color-fg-primary)',
                fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-32)'
              }}>x</p>
              <div className="flex flex-col items-center gap-4">
                <input type="number" inputMode="numeric" value={yellowGoals}
                  onChange={e => setYellowGoals(e.target.value)}
                  placeholder="00" min={0}
                  className="text-center font-bold outline-none w-[82px] rounded-2xl"
                  style={{
                    background: 'white', color: 'var(--color-fg-primary)',
                    fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-32)',
                    padding: '8px 12px', border: '2px solid var(--color-border)'
                  }} />
                <img src="/team-yellow.png" alt="Time Amarelo" width={96} height={96}
                  style={{ objectFit: 'contain' }} />
              </div>
            </div>

            <button
              onClick={() => saveScore.mutate()}
              disabled={saveScore.isPending || blueGoals === '' || yellowGoals === ''}
              className="w-full py-4 font-medium transition-all active:scale-95 disabled:opacity-40"
              style={{
                background: 'var(--color-surface-accent)', color: 'white',
                borderRadius: 'var(--radius-pill)',
                fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)'
              }}>
              {saveScore.isPending ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

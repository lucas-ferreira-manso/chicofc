import { useState, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Header from '../components/layout/Header'
import BadgeRanking from '../components/BadgeRanking'
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
import { fetchLastGamePlayers, fetchVotingRanking } from '../lib/playerStats'

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
interface HistoryEntry {
  gameId: string
  cheiaWinner: PlayerInfo | null
  murchaWinner: PlayerInfo | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getLastWednesdayId(): string {
  const today = new Date()
  const daysBack = (today.getDay() - 3 + 7) % 7
  const d = new Date(today)
  d.setDate(today.getDate() - daysBack)
  return format(d, 'yyyy-MM-dd')
}

// Votação aberta de quarta (dia do jogo) até domingo; encerrada toda segunda-feira.
// Dias: 0=dom 1=seg 2=ter 3=qua 4=qui 5=sex 6=sáb
function isVotingOpen(): boolean {
  const day = new Date().getDay()
  return day !== 1 && day !== 2 // seg e ter = fechado
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

async function fetchAllPlayers(): Promise<PlayerInfo[]> {
  const snap = await getDocs(collection(db, 'players'))
  return snap.docs
    .filter(d => d.data().active !== false)
    .map(d => ({
      id: d.id,
      name: d.data().name || d.data().email || 'Jogador',
      photoURL: d.data().photoURL
    }))
}

async function fetchVotacaoHistory(currentGameId: string): Promise<HistoryEntry[]> {
  const [votacaoSnap, allPlayers] = await Promise.all([
    getDocs(collection(db, 'votacao')),
    fetchAllPlayers()
  ])
  const playerMap = new Map(allPlayers.map(p => [p.id, p]))
  return votacaoSnap.docs
    .filter(d => d.id !== currentGameId && Object.keys(d.data().votos ?? {}).length > 0)
    .sort((a, b) => b.id.localeCompare(a.id))
    .map(d => {
      const votos = d.data().votos ?? {}
      const cheiaId = computeWinner(votos, 'bolaCheia')
      const murchaId = computeWinner(votos, 'bolaMurcha')
      return {
        gameId: d.id,
        cheiaWinner: cheiaId ? (playerMap.get(cheiaId) ?? null) : null,
        murchaWinner: murchaId ? (playerMap.get(murchaId) ?? null) : null,
      }
    })
    .filter(e => e.cheiaWinner || e.murchaWinner)
}

function BolaCheiaIcon({ size = 52 }: { size?: number }) {
  return (
    <img
      src="/bola-cheia.png"
      alt="Bola Cheia"
      width={size}
      height={size}
      style={{ width: size, height: size, objectFit: 'contain', pointerEvents: 'none' }}
    />
  )
}

function BolaMurchaIcon({ size = 52 }: { size?: number }) {
  return (
    <img
      src="/bola-murcha.png"
      alt="Bola Murcha"
      width={size}
      height={size}
      style={{ width: size, height: size, objectFit: 'contain', pointerEvents: 'none' }}
    />
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
        <img src={player.photoURL} alt={player.name} crossOrigin="anonymous"
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
  completed?: boolean
}

function BadgeVotacao({ type, player, onClick, disabled, completed }: BadgeProps) {
  const isMurcha = type === 'bolaMurcha'
  const accentColor = completed ? 'white' : isMurcha ? '#ed0000' : 'var(--color-fg-accent)'
  const nameColor = completed ? 'rgba(255,255,255,0.8)' : 'var(--color-fg-secondary)'
  const label = isMurcha ? 'Bola Murcha' : 'Bola Cheia'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 133, position: 'relative' }}>
      {/* Área da foto/placeholder */}
      <button
        onClick={onClick}
        disabled={disabled || !onClick}
        style={{
          aspectRatio: '1/1', borderRadius: 24, width: '100%',
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
              src={player.photoURL} alt={player.name} crossOrigin="anonymous"
              style={{
                position: 'absolute', inset: 0,
                width: '100%', height: '100%',
                objectFit: 'cover', objectPosition: 'center top',
                display: 'block', pointerEvents: 'none'
              }}
            />
          ) : (
            <span style={{
              fontFamily: 'var(--font-primary)', fontWeight: 700,
              fontSize: 48, color: 'var(--color-badge-initials)', opacity: 0.4
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
          fontSize: 14, color: nameColor
        }}>
          {player ? player.name : 'nome atleta'}
        </span>
      </div>

      {/* Ícone da bola sobreposto */}
      <div style={{ position: 'absolute', right: -3, bottom: 40, pointerEvents: 'none' }}>
        {isMurcha ? <BolaMurchaIcon size={52} /> : <BolaCheiaIcon size={52} />}
      </div>
    </div>
  )
}

// ─── Small Card Votação (histórico) ───────────────────────────────────────────

function SmallCardVotacao({ entry, onClick }: { entry: HistoryEntry; onClick: () => void }) {
  const dateLabel = (() => {
    try { return format(new Date(entry.gameId + 'T12:00:00'), 'dd/MM/yyyy') } catch { return entry.gameId }
  })()

  const MiniPhoto = ({ player }: { player: PlayerInfo | null }) => (
    <div style={{
      width: 63, height: 71, borderRadius: 16, overflow: 'hidden', flexShrink: 0,
      background: 'var(--color-surface-secondary)', position: 'relative'
    }}>
      {player?.photoURL ? (
        <img src={player.photoURL} alt={player.name} crossOrigin="anonymous"
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', display: 'block' }} />
      ) : player ? (
        <span style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-primary)', fontWeight: 700, fontSize: 22,
          color: 'var(--color-badge-initials)', opacity: 0.5
        }}>
          {getInitials(player.name)}
        </span>
      ) : null}
    </div>
  )

  return (
    <button onClick={onClick} style={{
      width: 164, borderRadius: 24, overflow: 'hidden',
      position: 'relative', display: 'flex', flexDirection: 'column',
      alignItems: 'center', gap: 8, padding: '12px 8px 8px',
      border: 'none', cursor: 'pointer', background: 'transparent'
    }}>
      {/* Stadium bg */}
      <img src="/stadium-bg.png" aria-hidden alt=""
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', pointerEvents: 'none' }} />

      {/* Content */}
      <img src="/team-blue.png" alt="" style={{ width: 32, height: 32, objectFit: 'contain', position: 'relative', flexShrink: 0 }} />
      <div style={{ width: '100%', position: 'relative', textAlign: 'center' }}>
        <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 600, fontSize: 12, lineHeight: '16px', color: 'white' }}>
          Bola Cheia/Murcha
        </p>
        <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 400, fontSize: 11, color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>
          Pelada dia {dateLabel}
        </p>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, width: '100%', position: 'relative', padding: '0 4px' }}>
        <div style={{ position: 'relative' }}>
          <MiniPhoto player={entry.cheiaWinner} />
          <div style={{ position: 'absolute', right: -1.4, top: 48, pointerEvents: 'none' }}>
            <BolaCheiaIcon size={25} />
          </div>
        </div>
        <div style={{ position: 'relative' }}>
          <MiniPhoto player={entry.murchaWinner} />
          <div style={{ position: 'absolute', right: -1.4, top: 48, pointerEvents: 'none' }}>
            <BolaMurchaIcon size={25} />
          </div>
        </div>
      </div>
    </button>
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
  const accentColor = isMurcha ? '#ed0000' : 'var(--color-fg-accent)'

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
          width: '100%', background: 'var(--color-bg)',
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
  const [historySheet, setHistorySheet] = useState<HistoryEntry | null>(null)
  const [sharing, setSharing] = useState(false)
  const shareCardRef = useRef<HTMLDivElement>(null)
  const historyShareRef = useRef<HTMLDivElement>(null)

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

  const { data: history = [] } = useQuery({
    queryKey: ['votacao-history', gameId],
    queryFn: () => fetchVotacaoHistory(gameId),
    staleTime: 5 * 60_000
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

  // Utilitário: converte toBlob (callback) em Promise
  const blobFromCanvas = (canvas: HTMLCanvasElement): Promise<Blob> =>
    new Promise((resolve, reject) => {
      canvas.toBlob(blob => {
        if (blob) resolve(blob)
        else reject(new Error('canvas.toBlob retornou null'))
      }, 'image/png')
    })

  const shareFromRef = async (ref: React.RefObject<HTMLDivElement>) => {
    if (!ref.current) return
    setSharing(true)
    try {
      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(ref.current, {
        backgroundColor: '#111827',   // fundo escuro explícito (evita canvas vazio)
        scale: 2,
        useCORS: true,                 // solicita CORS para imagens externas
        logging: false,
        ignoreElements: (el) => el.hasAttribute('data-share-exclude')
      })
      const blob = await blobFromCanvas(canvas)
      const file = new File([blob], 'bola-cheia-chicofc.png', { type: 'image/png' })

      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Bola Cheia & Bola Murcha ⚽' })
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = 'bola-cheia-chicofc.png'; a.click()
        URL.revokeObjectURL(url)
        toast.success('Imagem salva!')
      }
    } catch (e: any) {
      // AbortError = usuário cancelou o compartilhamento — não é erro
      if (e?.name !== 'AbortError') {
        console.error('[Share] erro:', e)
        toast.error('Não foi possível gerar a imagem')
      }
    } finally {
      setSharing(false)
    }
  }

  const handleShare = () => shareFromRef(shareCardRef)
  const handleShareHistory = () => shareFromRef(historyShareRef)

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
  const votingOpen = isVotingOpen()

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

  // ── helpers reutilizáveis ─────────────────────────────────────────────────
  const BigCard = ({ entry, cardRef, onShare }: {
    entry: { cheiaWinner: PlayerInfo | null; murchaWinner: PlayerInfo | null; gameId?: string }
    cardRef: React.RefObject<HTMLDivElement>
    onShare: () => void
  }) => {
    const dateLabel = entry.gameId
      ? (() => { try { return format(new Date(entry.gameId + 'T12:00:00'), "d 'de' MMMM", { locale: ptBR }) } catch { return '' } })()
      : null
    return (
      <div ref={cardRef} style={{
        display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center',
        padding: '24px 16px 16px', borderRadius: 24,
        position: 'relative', overflow: 'hidden',
        aspectRatio: '1/1', width: '100%'
      }}>
        <img src="/stadium-bg.png" aria-hidden alt=""
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', pointerEvents: 'none' }} />

        <img src="/team-blue.png" alt="ChicoFC"
          style={{ width: 68, height: 68, objectFit: 'contain', flexShrink: 0, position: 'relative' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', textAlign: 'center', position: 'relative' }}>
          <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 600, fontSize: 24, lineHeight: '28px', color: 'white' }}>
            Parabéns aos envolvidos!
          </p>
          <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 500, fontSize: 16, color: 'rgba(255,255,255,0.85)' }}>
            {dateLabel ? `Pelada dia ${format(new Date(entry.gameId! + 'T12:00:00'), 'dd/MM/yyyy')}` : 'Vocês foram os escolhidos ao bola cheia e bola murcha da rodada!'}
          </p>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 8px', width: '100%', alignItems: 'center', position: 'relative', flex: 1 }}>
          <BadgeVotacao type="bolaCheia" player={entry.cheiaWinner} disabled completed />
          <BadgeVotacao type="bolaMurcha" player={entry.murchaWinner} disabled completed />
        </div>
        <button data-share-exclude onClick={onShare} disabled={sharing}
          style={{
            width: '100%', height: 56, borderRadius: 9999,
            background: 'white', border: 'none',
            color: 'var(--color-fg-accent)', fontFamily: 'var(--font-primary)',
            fontWeight: 500, fontSize: 16, cursor: sharing ? 'default' : 'pointer',
            position: 'relative', flexShrink: 0,
            opacity: sharing ? 0.7 : 1
          }}>
          {sharing ? 'Gerando imagem...' : 'Compartilhar'}
        </button>
      </div>
    )
  }

  const HistoryGrid = () => {
    if (history.length === 0) return null
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 600, fontSize: 16, color: 'var(--color-fg-primary)' }}>
          Histórico
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {history.map(entry => (
            <SmallCardVotacao key={entry.gameId} entry={entry} onClick={() => setHistorySheet(entry)} />
          ))}
        </div>
      </div>
    )
  }

  // ── Estado: votação encerrada (toda segunda-feira) ────────────────────────
  if (!votingOpen) {
    if (cheiaWinnerId || murchaWinnerId) {
      return (
        <>
          <BigCard
            entry={{ cheiaWinner, murchaWinner }}
            cardRef={shareCardRef}
            onShare={handleShare}
          />
          <HistoryGrid />
          {historySheet && (
            <>
              <div onClick={() => setHistorySheet(null)}
                style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 70 }} />
              <div style={{
                position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 70,
                background: 'var(--color-bg)', borderRadius: '24px 24px 0 0',
                padding: '16px 16px 40px',
                display: 'flex', flexDirection: 'column', gap: 12
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px 4px' }}>
                  <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 600, fontSize: 16, color: 'var(--color-fg-primary)' }}>
                    Resultado anterior
                  </p>
                  <button onClick={() => setHistorySheet(null)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                    <X size={20} color="var(--color-fg-secondary)" />
                  </button>
                </div>
                <BigCard
                  entry={historySheet}
                  cardRef={historyShareRef}
                  onShare={handleShareHistory}
                />
              </div>
            </>
          )}
        </>
      )
    }
    return (
      <>
        <p style={{
          textAlign: 'center', padding: '32px 0',
          fontFamily: 'var(--font-primary)', fontSize: 16,
          color: 'var(--color-fg-secondary)'
        }}>
          Votação encerrada. Volte na quarta após o jogo!
        </p>
        <HistoryGrid />
        {historySheet && (
          <>
            <div onClick={() => setHistorySheet(null)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 70 }} />
            <div style={{
              position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 70,
              background: 'var(--color-bg)', borderRadius: '24px 24px 0 0',
              padding: '16px 16px 40px',
              display: 'flex', flexDirection: 'column', gap: 12
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px 4px' }}>
                <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 600, fontSize: 16, color: 'var(--color-fg-primary)' }}>
                  Resultado anterior
                </p>
                <button onClick={() => setHistorySheet(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                  <X size={20} color="var(--color-fg-secondary)" />
                </button>
              </div>
              <BigCard
                entry={historySheet}
                cardRef={historyShareRef}
                onShare={handleShareHistory}
              />
            </div>
          </>
        )}
      </>
    )
  }

  const HistorySheetEl = historySheet && (
    <>
      <div onClick={() => setHistorySheet(null)}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 70 }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 70,
        background: 'var(--color-bg)', borderRadius: '24px 24px 0 0',
        padding: '16px 16px 40px', display: 'flex', flexDirection: 'column', gap: 12
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px 4px' }}>
          <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 600, fontSize: 16, color: 'var(--color-fg-primary)' }}>
            Resultado anterior
          </p>
          <button onClick={() => setHistorySheet(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <X size={20} color="var(--color-fg-secondary)" />
          </button>
        </div>
        <BigCard entry={historySheet} cardRef={historyShareRef} onShare={handleShareHistory} />
      </div>
    </>
  )

  // ── Estado: usuário já votou (votação ainda aberta) ───────────────────────
  if (hasVoted) {
    return (
      <>
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center',
          padding: '24px 16px 16px', borderRadius: 24,
          position: 'relative', overflow: 'hidden', width: '100%'
        }}>
          <img src="/stadium-bg.png" aria-hidden alt=""
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', pointerEvents: 'none' }} />
          <img src="/team-blue.png" alt="ChicoFC" style={{ width: 68, height: 68, objectFit: 'contain', flexShrink: 0, position: 'relative' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', textAlign: 'center', position: 'relative' }}>
            <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 600, fontSize: 24, lineHeight: '28px', color: 'white' }}>
              Parabéns aos envolvidos!
            </p>
            <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 500, fontSize: 16, color: 'rgba(255,255,255,0.85)' }}>
              Vocês foram os escolhidos ao bola cheia e bola murcha da rodada!
            </p>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 8px', width: '100%', alignItems: 'center', position: 'relative' }}>
            <BadgeVotacao type="bolaCheia" player={cheiaWinner} disabled completed />
            <BadgeVotacao type="bolaMurcha" player={murchaWinner} disabled completed />
          </div>
        </div>
        <HistoryGrid />
        {HistorySheetEl}
      </>
    )
  }

  // ── Estado: usuário não jogou ─────────────────────────────────────────────
  if (!userWasConfirmed) {
    return (
      <>
        {cheiaWinnerId || murchaWinnerId ? (
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center',
            padding: '24px 16px 16px', borderRadius: 24,
            position: 'relative', overflow: 'hidden', width: '100%'
          }}>
            <img src="/stadium-bg.png" aria-hidden alt=""
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', pointerEvents: 'none' }} />
            <img src="/team-blue.png" alt="ChicoFC" style={{ width: 68, height: 68, objectFit: 'contain', flexShrink: 0, position: 'relative' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', textAlign: 'center', position: 'relative' }}>
              <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 600, fontSize: 24, lineHeight: '28px', color: 'white' }}>
                Parabéns aos envolvidos!
              </p>
              <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 500, fontSize: 16, color: 'rgba(255,255,255,0.85)' }}>
                Vocês foram os escolhidos ao bola cheia e bola murcha da rodada!
              </p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 8px', width: '100%', alignItems: 'center', position: 'relative' }}>
              <BadgeVotacao type="bolaCheia" player={cheiaWinner} disabled completed />
              <BadgeVotacao type="bolaMurcha" player={murchaWinner} disabled completed />
            </div>
          </div>
        ) : (
          <p style={{ textAlign: 'center', padding: '32px 0', fontFamily: 'var(--font-primary)', fontSize: 16, color: 'var(--color-fg-secondary)' }}>
            Você não participou deste jogo.
          </p>
        )}
        <HistoryGrid />
        {HistorySheetEl}
      </>
    )
  }

  // ── Estado: pré-votação ───────────────────────────────────────────────────
  return (
    <>
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 10,
        padding: '24px 16px 16px', borderRadius: 24,
        position: 'relative', overflow: 'hidden', width: '100%'
      }}>
        <img src="/stadium-bg.png" aria-hidden alt=""
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', pointerEvents: 'none' }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'center', position: 'relative' }}>
          <p style={{
            fontFamily: 'var(--font-primary)', fontWeight: 600,
            fontSize: 24, lineHeight: '28px', color: 'white'
          }}>
            Chegou a hora de julgar!
          </p>
          <p style={{
            fontFamily: 'var(--font-primary)', fontWeight: 500,
            fontSize: 16, color: 'rgba(255,255,255,0.85)'
          }}>
            Vote no Bola Cheia e Bola murcha da rodada!
          </p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 8px', position: 'relative' }}>
          <BadgeVotacao
            type="bolaCheia"
            player={pendingCheiaPlayer}
            onClick={() => setSheetType('bolaCheia')}
            completed
          />
          <BadgeVotacao
            type="bolaMurcha"
            player={pendingMurchaPlayer}
            onClick={() => setSheetType('bolaMurcha')}
            completed
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
              background: 'white', color: 'var(--color-fg-accent)',
              fontFamily: 'var(--font-primary)', fontWeight: 500, fontSize: 16,
              border: 'none', cursor: 'pointer', position: 'relative', flexShrink: 0
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

      <HistoryGrid />
      {HistorySheetEl}
    </>
  )
}

// ─── Aba Ranking ──────────────────────────────────────────────────────────────

function RankingTab() {
  const navigate = useNavigate()

  const { data: presenca = [], isLoading: loadingPresenca } = useQuery({
    queryKey: ['last-game-players'],
    queryFn: fetchLastGamePlayers,
    staleTime: 5 * 60_000
  })

  const { data: votacao = [], isLoading: loadingVotacao } = useQuery({
    queryKey: ['voting-ranking'],
    queryFn: fetchVotingRanking,
    staleTime: 5 * 60_000
  })

  const loading = loadingPresenca || loadingVotacao

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
        <div className="text-4xl animate-spin">⚽</div>
      </div>
    )
  }

  const top3Presenca = presenca.slice(0, 3)
  const podiumPresenca = [top3Presenca[1] ?? null, top3Presenca[0] ?? null, top3Presenca[2] ?? null]

  const cheiaRanking = [...votacao].sort((a, b) => b.bolaCheiaWins - a.bolaCheiaWins).filter(p => p.bolaCheiaWins > 0)
  const top3Cheia = cheiaRanking.slice(0, 3)
  const podiumCheia = [top3Cheia[1] ?? null, top3Cheia[0] ?? null, top3Cheia[2] ?? null]

  const SectionHeader = ({ title, onVerTodos }: { title: string; onVerTodos: () => void }) => (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
      <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 600, fontSize: 'var(--font-size-16)', color: 'var(--color-fg-primary)' }}>
        {title}
      </p>
      <button onClick={onVerTodos} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
        <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 500, fontSize: 'var(--font-size-14)', color: 'var(--color-fg-accent)' }}>
          Ver todos
        </p>
      </button>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Top 3 mais presentes */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 8 }}>
        <SectionHeader title="Top 3 mais presentes" onVerTodos={() => navigate('/presenca')} />
        {presenca.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--color-fg-secondary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-14)', padding: '16px 0' }}>
            Nenhuma presença registrada ainda.
          </p>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <BadgeRanking player={podiumPresenca[0]} rank={2} count={podiumPresenca[0]?.confirmed} />
            <BadgeRanking player={podiumPresenca[1]} rank={1} count={podiumPresenca[1]?.confirmed} />
            <BadgeRanking player={podiumPresenca[2]} rank={3} count={podiumPresenca[2]?.confirmed} />
          </div>
        )}
      </div>

      <div style={{ height: 1, background: 'var(--color-border)' }} />

      {/* Top 3 Bola Cheia */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 8 }}>
        <SectionHeader title="Top 3 Bola Cheia" onVerTodos={() => navigate('/ranking-votacao')} />
        {cheiaRanking.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--color-fg-secondary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-14)', padding: '16px 0' }}>
            Nenhuma votação registrada ainda.
          </p>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <BadgeRanking player={podiumCheia[0]} rank={2} />
            <BadgeRanking player={podiumCheia[1]} rank={1} />
            <BadgeRanking player={podiumCheia[2]} rank={3} />
          </div>
        )}
      </div>

    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function StatsPage() {
  const user = useAuthStore(s => s.user)
  const isAdmin = user?.role === 'admin'
  const qc = useQueryClient()

  const [searchParams, setSearchParams] = useSearchParams()
  const TABS = ['placar', 'jogador', 'ranking'] as const
  type Tab = typeof TABS[number]
  const tabParam = searchParams.get('tab') as Tab | null
  const [activeTab, setActiveTab] = useState<Tab>(
    tabParam && TABS.includes(tabParam) ? tabParam : 'placar'
  )

  function handleTabChange(tab: Tab) {
    setActiveTab(tab)
    setSearchParams({ tab }, { replace: true })
  }
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

  const rankingUpdatedAt = qc.getQueryState(['last-game-players'])?.dataUpdatedAt
  const rankingUpdatedStr = rankingUpdatedAt
    ? format(new Date(rankingUpdatedAt), "d 'de' MMMM 'às' HH'h'mm", { locale: ptBR })
    : null

  const subtitle = activeTab === 'placar'
    ? (updatedStr ? `Atualizado ${updatedStr}` : 'Nenhuma atualização ainda')
    : activeTab === 'jogador'
    ? `Jogo de ${gameDate}`
    : (rankingUpdatedStr ? `Atualizado ${rankingUpdatedStr}` : 'Ranking geral')

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
          {(['placar', 'jogador', 'ranking'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              style={{
                flex: 1, padding: '8px 12px',
                borderRadius: 16, border: 'none',
                background: activeTab === tab ? 'white' : 'transparent',
                color: activeTab === tab ? '#1a1a1a' : 'var(--color-fg-primary)',
                fontFamily: 'var(--font-primary)', fontWeight: 500,
                fontSize: 16, cursor: 'pointer',
                transition: 'background 0.15s',
                boxShadow: activeTab === tab ? '0 1px 4px rgba(0,0,0,0.08)' : 'none'
              }}>
              {tab === 'placar' ? 'Placar' : tab === 'jogador' ? 'Jogador' : 'Ranking'}
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
                        // Deriva a quarta-feira do jogo a partir da data de input
                        const gameWed = (() => {
                          const d = new Date(entry.date.includes('T') ? entry.date : entry.date + 'T12:00:00')
                          const daysBack = (d.getDay() - 3 + 7) % 7
                          d.setDate(d.getDate() - daysBack)
                          return d
                        })()
                        const dateStr = format(gameWed, 'dd/MM')
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

        {/* ── Aba Ranking ── */}
        {activeTab === 'ranking' && <RankingTab />}
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
                    background: 'white', color: '#1a1a1a',
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
                    background: 'white', color: '#1a1a1a',
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

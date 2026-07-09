import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { doc, getDoc, setDoc, collection, getDocs, query, where } from 'firebase/firestore'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CaretLeft } from '@phosphor-icons/react'
import { db } from '../lib/firebase'
import { useAuthStore } from '../store/authStore'
import { toast } from 'sonner'
import { useLockBodyScroll } from '../lib/useLockBodyScroll'
import { getLastWednesdayId, isVotingOpen, getInitials } from '../components/stats/VotacaoComponents'
import type { PlayerInfo } from '../lib/playerStats'

// ─── Types ────────────────────────────────────────────────────────────────────

type VoteV2 = {
  bolaCheia: string
  bolaMurcha: string
  melhorDefensor: string
  piorDefensor: string
}

type VotacaoV2Data = {
  votos: Record<string, Partial<VoteV2>>
}

const STEPS = [
  { key: 'bolaCheia'      as const, label: 'Bola Cheia',     hubLabel: 'Bola Cheia',    resultLabel: 'Bola Cheia',   resultSub: 'Melhor jogador',  sub: 'Melhor jogador da rodada',  accentColor: '#34c759', bgColor: 'rgba(52,199,89,.08)'  },
  { key: 'bolaMurcha'     as const, label: 'Bola Murcha',    hubLabel: 'Bola Murcha',   resultLabel: 'Bola Murcha',  resultSub: 'Pior jogador',    sub: 'Pior jogador da rodada',    accentColor: '#ff3b30', bgColor: 'rgba(255,59,48,.08)'  },
  { key: 'melhorDefensor' as const, label: 'Melhor Defensor',hubLabel: 'Prêmio Lúcio',  resultLabel: 'Prêmio Lúcio', resultSub: 'Melhor defensor', sub: 'Destaque defensivo (+3 pts)',accentColor: '#fad026', bgColor: 'rgba(250,208,38,.08)' },
  { key: 'piorDefensor'   as const, label: 'Pior Defensor',  hubLabel: 'Rodrigo Caio',  resultLabel: 'Rodrigo Caio', resultSub: 'Pior defensor',   sub: 'Pior na defesa (−1 pt)',    accentColor: '#ff6b35', bgColor: 'rgba(255,107,53,.08)' },
]

// ─── Data ─────────────────────────────────────────────────────────────────────

async function fetchConfirmedPlayers(gameId: string): Promise<PlayerInfo[]> {
  const q = query(collection(db, 'attendances'), where('game_id', '==', gameId), where('status', 'in', ['confirmed', 'waitlist']))
  const snap = await getDocs(q)
  const userIds = [...new Set(snap.docs.map(d => d.data().user_id as string))]
  const profiles = await Promise.all(userIds.map(async id => {
    const pSnap = await getDoc(doc(db, 'players', id))
    if (!pSnap.exists()) return null
    const data = pSnap.data()
    return { id, name: data.name || data.email || 'Jogador', photoURL: data.photoURL } as PlayerInfo
  }))
  return profiles.filter(Boolean) as PlayerInfo[]
}

async function fetchVotacaoV2(gameId: string): Promise<VotacaoV2Data> {
  const snap = await getDoc(doc(db, 'votacao', gameId))
  if (!snap.exists()) return { votos: {} }
  return { votos: snap.data().votos ?? {} }
}

function computeWinnerV2(
  votos: Record<string, Partial<VoteV2>>,
  type: keyof VoteV2
): string | null {
  const counts: Record<string, number> = {}
  Object.values(votos).forEach(v => {
    const id = v[type]
    if (id) counts[id] = (counts[id] || 0) + 1
  })
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PlayerAvatar({ player, size = 36 }: { player: PlayerInfo; size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'var(--color-avatar-bg)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {player.photoURL
        ? <img src={player.photoURL} alt={player.name} crossOrigin="anonymous" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <span style={{ color: 'var(--color-avatar-fg)', fontFamily: 'var(--font-primary)', fontSize: size * 0.38, fontWeight: 600 }}>{getInitials(player.name)}</span>
      }
    </div>
  )
}

function Stepper({ currentStep, votes }: { currentStep: number; votes: Partial<VoteV2> }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '12px 0 4px' }}>
      {STEPS.map((step, i) => {
        const done = !!votes[step.key]
        const isCurrent = i === currentStep
        return (
          <div key={step.key} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : undefined }}>
            {done ? (
              <div style={{ width: 40, height: 40, borderRadius: 99, border: '1.5px solid #34c759', background: 'rgba(52,199,89,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L19 7" stroke="#34c759" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
            ) : isCurrent ? (
              <div style={{ height: 40, borderRadius: 99, border: '1.5px solid var(--color-fg-accent)', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 14px', flexShrink: 0, whiteSpace: 'nowrap' }}>
                <span style={{ fontFamily: 'var(--font-primary)', fontSize: 13, fontWeight: 500, color: 'var(--color-fg-accent)' }}>{step.label}</span>
              </div>
            ) : (
              <div style={{ width: 40, height: 40, borderRadius: 99, border: '1.5px solid var(--color-fg-accent)', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: .5 }}>
                <span style={{ fontFamily: 'var(--font-primary)', fontSize: 14, fontWeight: 500, color: 'var(--color-fg-accent)' }}>{i + 1}</span>
              </div>
            )}
            {i < STEPS.length - 1 && (
              <div style={{ flex: 1, height: 1.5, background: done ? '#34c759' : 'var(--color-fg-accent)', opacity: done ? .8 : .25, minWidth: 4 }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function HubBadge({ step, winner, onClick }: { step: typeof STEPS[number]; winner: PlayerInfo | null; onClick?: () => void }) {
  const icons: Record<string, React.ReactNode> = {
    bolaCheia:      <img src="/bola-cheia.png"  alt="" style={{ width: '130%', height: '130%', objectFit: 'contain', pointerEvents: 'none' }} />,
    bolaMurcha:     <img src="/bola-murcha.png" alt="" style={{ width: '130%', height: '130%', objectFit: 'contain', pointerEvents: 'none' }} />,
    melhorDefensor: <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M12 2L4 5.5v7C4 17 7.6 21 12 22c4.4-1 8-5 8-9.5v-7L12 2Z" fill="#fad026" opacity=".85"/><path d="M9 12l2 2 4-4" stroke="#111" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
    piorDefensor:   <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M12 2L4 5.5v7C4 17 7.6 21 12 22c4.4-1 8-5 8-9.5v-7L12 2Z" fill="#ff6b35" opacity=".8"/><path d="M9 12h6" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  }

  return (
    <div onClick={onClick} style={{ flex: 1, borderRadius: 16, border: '1.5px solid rgba(255,255,255,.15)', background: 'rgba(255,255,255,.08)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '10px 6px', cursor: onClick ? 'pointer' : 'default', overflow: 'hidden' }}>
      <div style={{ width: 60, height: 60, borderRadius: 12, overflow: 'hidden', background: 'rgba(255,255,255,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {winner?.photoURL
          ? <img src={winner.photoURL} alt={winner.name} crossOrigin="anonymous" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
          : winner
            ? <span style={{ fontFamily: 'var(--font-primary)', fontWeight: 700, fontSize: 20, color: '#fff', opacity: .7 }}>{getInitials(winner.name)}</span>
            : icons[step.key]
        }
      </div>
      <span style={{ fontFamily: 'var(--font-primary)', fontSize: 10, fontWeight: 600, color: winner ? '#fff' : 'rgba(255,255,255,.7)', textAlign: 'center', lineHeight: 1.3 }}>
        {winner ? winner.name.split(' ')[0] : step.hubLabel}
      </span>
    </div>
  )
}

function ResultSheet({ players, votos, onClose, onShare, sharing }: {
  players: PlayerInfo[]
  votos: Record<string, Partial<VoteV2>>
  onClose: () => void
  onShare: () => void
  sharing: boolean
}) {
  const playerMap = new Map(players.map(p => [p.id, p]))
  const winners = STEPS.map(s => ({
    step: s,
    player: (() => { const id = computeWinnerV2(votos, s.key); return id ? (playerMap.get(id) ?? null) : null })()
  }))

  const labelColors: Record<string, string> = {
    bolaCheia: 'var(--color-fg-primary)', bolaMurcha: 'var(--color-danger)',
    melhorDefensor: 'var(--color-fg-primary)', piorDefensor: 'var(--color-danger)',
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 70 }} />
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 80, background: 'var(--color-bg)', borderRadius: '24px 24px 0 0', padding: '16px 16px calc(32px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '92dvh', overflowY: 'auto' }}>
        <div style={{ width: 36, height: 4, borderRadius: 99, background: 'var(--color-surface-secondary)', margin: '0 auto 4px', flexShrink: 0 }} />

        {/* Result card (shareable) */}
        <div ref={undefined} style={{ borderRadius: 20, overflow: 'hidden', position: 'relative' }}>
          <img src="/stadium-bg.png" aria-hidden alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.5)', pointerEvents: 'none' }} />
          <div style={{ position: 'relative', padding: '20px 16px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <img src="/team-blue.png" alt="ChicoFC" style={{ width: 52, height: 52, objectFit: 'contain' }} />
            </div>
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 700, fontSize: 22, color: '#fff', lineHeight: 1.2 }}>Parabéns aos envolvidos!</p>
              <p style={{ fontFamily: 'var(--font-primary)', fontSize: 13, color: 'rgba(255,255,255,.75)', lineHeight: 1.5 }}>Vocês foram os escolhidos ao bola cheia e bola murcha da rodada!</p>
            </div>

            {/* 2×2 grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {winners.map(({ step, player }) => (
                <div key={step.key} style={{ borderRadius: 20, overflow: 'hidden', background: 'var(--color-bg)' }}>
                  <div style={{ height: 150, overflow: 'hidden', background: 'var(--color-surface-secondary)', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {player?.photoURL
                      ? <img src={player.photoURL} alt={player.name} crossOrigin="anonymous" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }} />
                      : player
                        ? <span style={{ fontFamily: 'var(--font-primary)', fontWeight: 700, fontSize: 44, color: 'var(--color-badge-initials)', opacity: .35 }}>{getInitials(player.name)}</span>
                        : <span style={{ fontFamily: 'var(--font-primary)', fontSize: 13, color: 'var(--color-fg-secondary)' }}>—</span>
                    }
                  </div>
                  <div style={{ padding: '10px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--color-surface-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                      {step.key === 'bolaCheia'  && <img src="/bola-cheia.png"  alt="" style={{ width: '140%', height: '140%', objectFit: 'contain' }} />}
                      {step.key === 'bolaMurcha' && <img src="/bola-murcha.png" alt="" style={{ width: '140%', height: '140%', objectFit: 'contain' }} />}
                      {step.key === 'melhorDefensor' && <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 2L4 5.5v7C4 17 7.6 21 12 22c4.4-1 8-5 8-9.5v-7L12 2Z" fill="#fad026"/><path d="M9 12l2 2 4-4" stroke="#111" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      {step.key === 'piorDefensor'   && <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 2L4 5.5v7C4 17 7.6 21 12 22c4.4-1 8-5 8-9.5v-7L12 2Z" fill="#ff6b35"/><path d="M9 12h6" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/></svg>}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
                      <span style={{ fontFamily: 'var(--font-primary)', fontWeight: 700, fontSize: 12, color: labelColors[step.key], lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{step.resultLabel}</span>
                      <span style={{ fontFamily: 'var(--font-primary)', fontSize: 11, color: 'var(--color-fg-secondary)', lineHeight: 1.2 }}>{step.resultSub}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <button onClick={onShare} disabled={sharing} style={{ width: '100%', height: 52, borderRadius: 99, background: 'var(--color-surface-primary)', color: 'var(--color-fg-accent)', fontFamily: 'var(--font-primary)', fontWeight: 700, fontSize: 16, border: 'none', cursor: sharing ? 'default' : 'pointer', opacity: sharing ? .7 : 1 }}>
          {sharing ? 'Gerando...' : 'Compartilhar'}
        </button>
      </div>
    </>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StatsVotacaoPage() {
  const navigate = useNavigate()
  const user = useAuthStore(s => s.user)
  const qc = useQueryClient()
  const gameId = getLastWednesdayId()
  const votingOpen = isVotingOpen()

  const [view, setView] = useState<'hub' | 'voting'>('hub')
  const [currentStep, setCurrentStep] = useState(0)
  const [pendingVotes, setPendingVotes] = useState<Partial<VoteV2>>({})
  const [selectedInStep, setSelectedInStep] = useState<string | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [sharing, setSharing] = useState(false)
  const resultCardRef = useRef<HTMLDivElement>(null)

  useLockBodyScroll(showResult)

  const { data: players = [], isLoading: loadingPlayers } = useQuery({
    queryKey: ['confirmed-players-v2', gameId],
    queryFn: () => fetchConfirmedPlayers(gameId),
    refetchInterval: 30_000,
  })
  const { data: votacao, isLoading: loadingVotacao } = useQuery({
    queryKey: ['votacao-v2', gameId],
    queryFn: () => fetchVotacaoV2(gameId),
    refetchInterval: 10_000,
  })

  const saveVote = useMutation({
    mutationFn: async (votes: VoteV2) => {
      const current = votacao ?? { votos: {} }
      await setDoc(doc(db, 'votacao', gameId), {
        votos: { ...current.votos, [user!.id]: votes }
      }, { merge: true })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['votacao-v2', gameId] })
      qc.invalidateQueries({ queryKey: ['votacao', gameId] })
      setView('hub')
      setShowResult(true)
      toast.success('Votos registrados!')
    },
    onError: () => toast.error('Erro ao salvar votos.'),
  })

  const myVote = votacao?.votos?.[user!.id]
  const hasVotedV2 = !!(myVote?.bolaCheia && myVote?.bolaMurcha && myVote?.melhorDefensor && myVote?.piorDefensor)
  const userWasConfirmed = players.some(p => p.id === user!.id)

  const playerMap = new Map(players.map(p => [p.id, p]))
  const winners = Object.fromEntries(
    STEPS.map(s => [s.key, (() => { const id = computeWinnerV2(votacao?.votos ?? {}, s.key); return id ? (playerMap.get(id) ?? null) : null })()])
  ) as Record<keyof VoteV2, PlayerInfo | null>

  const gameDate = format(new Date(gameId + 'T12:00:00'), "d 'de' MMMM", { locale: ptBR })

  const isLoading = loadingPlayers || loadingVotacao

  // ─── Hub view ──────────────────────────────────────────────────────────────

  const HubView = () => (
    <div style={{ borderRadius: 24, overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column' }}>
      <img src="/stadium-bg.png" aria-hidden alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.5)', pointerEvents: 'none' }} />
      <div style={{ position: 'relative', padding: '18px 16px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Top row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontFamily: 'var(--font-primary)', fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,.55)', textTransform: 'uppercase', letterSpacing: '.08em' }}>
              Jogo de {gameDate}
            </span>
            <span style={{ fontFamily: 'var(--font-primary)', fontSize: 22, fontWeight: 700, color: '#fff', lineHeight: 1.15 }}>
              {votingOpen && !hasVotedV2 ? 'Votação Aberta' : hasVotedV2 ? 'Seu voto foi computado' : 'Resultado'}
            </span>
            <span style={{ fontFamily: 'var(--font-primary)', fontSize: 13, color: 'rgba(255,255,255,.75)' }}>
              {votingOpen && !hasVotedV2 ? 'Escolha os destaques da rodada!' : 'Obrigado por participar!'}
            </span>
          </div>
          {votingOpen && !hasVotedV2 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,.12)', borderRadius: 99, padding: '5px 10px', flexShrink: 0 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#fad026', animation: 'blink 1.4s ease-in-out infinite' }} />
              <span style={{ fontFamily: 'var(--font-primary)', fontSize: 11, fontWeight: 600, color: '#fff' }}>Ao vivo</span>
            </div>
          )}
          {hasVotedV2 && (
            <span style={{ fontFamily: 'var(--font-primary)', fontSize: 11, fontWeight: 600, color: '#34c759', background: 'rgba(52,199,89,.15)', padding: '5px 10px', borderRadius: 99, flexShrink: 0 }}>✓ Votou</span>
          )}
        </div>

        {/* 4 badges */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {STEPS.map(step => (
            <HubBadge
              key={step.key}
              step={step}
              winner={winners[step.key]}
            />
          ))}
        </div>

        {/* CTA */}
        {votingOpen && !hasVotedV2 && userWasConfirmed && (
          <button
            onClick={() => { setCurrentStep(0); setSelectedInStep(null); setPendingVotes({}); setView('voting') }}
            style={{ width: '100%', height: 50, borderRadius: 99, background: 'rgba(255,255,255,.95)', color: '#082996', fontFamily: 'var(--font-primary)', fontSize: 16, fontWeight: 700, border: 'none', cursor: 'pointer' }}
          >
            Votar agora!
          </button>
        )}
        {!userWasConfirmed && votingOpen && (
          <div style={{ textAlign: 'center', padding: '4px 0' }}>
            <span style={{ fontFamily: 'var(--font-primary)', fontSize: 13, color: 'rgba(255,255,255,.55)' }}>Você não participou deste jogo</span>
          </div>
        )}
        {hasVotedV2 && (
          <button onClick={() => setShowResult(true)} style={{ width: '100%', height: 50, borderRadius: 99, background: 'rgba(255,255,255,.15)', color: '#fff', fontFamily: 'var(--font-primary)', fontSize: 16, fontWeight: 600, border: '1.5px solid rgba(255,255,255,.25)', cursor: 'pointer' }}>
            Ver resultado completo
          </button>
        )}
      </div>
    </div>
  )

  // ─── Voting step view ──────────────────────────────────────────────────────

  const step = STEPS[currentStep]

  const VotingView = () => (
    <>
      <Stepper currentStep={currentStep} votes={pendingVotes} />

      {/* Step header */}
      <div style={{ borderRadius: 16, padding: '14px 16px', background: step.bgColor, display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: step.bgColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 24 }}>
          {step.key === 'bolaCheia'      && <img src="/bola-cheia.png"  alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />}
          {step.key === 'bolaMurcha'     && <img src="/bola-murcha.png" alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />}
          {step.key === 'melhorDefensor' && <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M12 2L4 5.5v7C4 17 7.6 21 12 22c4.4-1 8-5 8-9.5v-7L12 2Z" fill="#fad026"/><path d="M9 12l2 2 4-4" stroke="#111" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          {step.key === 'piorDefensor'   && <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M12 2L4 5.5v7C4 17 7.6 21 12 22c4.4-1 8-5 8-9.5v-7L12 2Z" fill="#ff6b35"/><path d="M9 12h6" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/></svg>}
        </div>
        <div>
          <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 600, fontSize: 16, color: 'var(--color-fg-primary)' }}>{step.label}</p>
          <p style={{ fontFamily: 'var(--font-primary)', fontSize: 12, color: 'var(--color-fg-secondary)', marginTop: 2 }}>{step.sub}</p>
        </div>
      </div>

      {/* Player list — exclui jogadores já votados em etapas anteriores */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {players.filter(p => !Object.values(pendingVotes).includes(p.id)).map(player => {
          const isSel = selectedInStep === player.id
          return (
            <button
              key={player.id}
              onClick={() => setSelectedInStep(player.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 16, background: 'var(--color-surface-primary)', border: `2px solid ${isSel ? step.accentColor : 'transparent'}`, cursor: 'pointer', width: '100%', textAlign: 'left', transition: 'border-color .12s' }}
            >
              <PlayerAvatar player={player} size={38} />
              <span style={{ fontFamily: 'var(--font-primary)', fontWeight: 500, fontSize: 15, color: 'var(--color-fg-primary)', flex: 1 }}>{player.name}</span>
              <div style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${isSel ? step.accentColor : 'var(--color-border)'}`, background: isSel ? step.accentColor : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background .12s, border-color .12s' }}>
                {isSel && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l2.5 2.5L9 1" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </div>
            </button>
          )
        })}
      </div>
    </>
  )

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100dvh', paddingBottom: 'calc(120px + env(safe-area-inset-bottom))' }}>

      {/* Sub-header */}
      <div className="fixed top-0 inset-x-0 z-40" style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 24px' }}>
          <button
            onClick={() => view === 'voting' ? setView('hub') : navigate('/stats')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', marginLeft: -4 }}
          >
            <CaretLeft size={24} color="var(--color-fg-primary)" weight="bold" />
          </button>
          <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 600, fontSize: 24, color: 'var(--color-fg-primary)', flex: 1, lineHeight: '28px' }}>
            {view === 'voting' ? step.label : 'Votação'}
          </p>
        </div>
        <p style={{ fontFamily: 'var(--font-primary)', fontSize: 14, color: 'var(--color-fg-secondary)', padding: '0 24px 12px' }}>
          Jogo de {gameDate}
        </p>
      </div>

      <div style={{ height: 84 }} />

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
          <div className="text-4xl animate-spin">⚽</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '16px 24px 0' }}>
          {view === 'hub'
            ? <HubView />
            : <VotingView />
          }
        </div>
      )}

      {/* Confirm / Next button (voting only) */}
      {view === 'voting' && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '12px 24px calc(28px + env(safe-area-inset-bottom))', background: 'var(--color-bg)', borderTop: '1px solid var(--color-border)', zIndex: 40 }}>
          <button
            disabled={!selectedInStep || saveVote.isPending}
            onClick={() => {
              if (!selectedInStep) return
              const updated = { ...pendingVotes, [step.key]: selectedInStep }
              if (currentStep < STEPS.length - 1) {
                setPendingVotes(updated)
                setSelectedInStep(null)
                setCurrentStep(currentStep + 1)
              } else {
                saveVote.mutate(updated as VoteV2)
              }
            }}
            className="transition-all active:scale-95 disabled:opacity-40"
            style={{ width: '100%', height: 56, borderRadius: 9999, background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-fg)', fontFamily: 'var(--font-primary)', fontWeight: 600, fontSize: 16, border: 'none', cursor: selectedInStep ? 'pointer' : 'default' }}
          >
            {saveVote.isPending ? 'Salvando...' : currentStep < STEPS.length - 1 ? 'Próximo' : 'Confirmar votos'}
          </button>
        </div>
      )}

      {/* Result sheet */}
      {showResult && votacao && (
        <ResultSheet
          players={players}
          votos={votacao.votos}
          onClose={() => setShowResult(false)}
          onShare={async () => {
            setSharing(true)
            try {
              const html2canvas = (await import('html2canvas')).default
              if (!resultCardRef.current) return
              const canvas = await html2canvas(resultCardRef.current, { backgroundColor: '#111827', scale: 2, useCORS: true, logging: false })
              const blob = await new Promise<Blob>((res, rej) => canvas.toBlob(b => b ? res(b) : rej(new Error('null')), 'image/png'))
              const file = new File([blob], 'votacao-chicofc.png', { type: 'image/png' })
              if (navigator.share && navigator.canShare({ files: [file] })) {
                await navigator.share({ files: [file], title: 'Votação ChicoFC' })
              } else {
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url; a.download = 'votacao-chicofc.png'; a.click()
                URL.revokeObjectURL(url)
                toast.success('Imagem salva!')
              }
            } catch (e: any) {
              if (e?.name !== 'AbortError') toast.error('Não foi possível compartilhar')
            } finally { setSharing(false) }
          }}
          sharing={sharing}
        />
      )}

      <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:.25} }`}</style>
    </div>
  )
}

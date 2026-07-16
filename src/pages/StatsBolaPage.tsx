import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { doc, getDoc, setDoc, collection, getDocs, query, where } from 'firebase/firestore'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CaretLeft, X } from '@phosphor-icons/react'
import { db } from '../lib/firebase'
import { useAuthStore } from '../store/authStore'
import { toast } from 'sonner'
import type { PlayerInfo, HistoryEntry } from '../lib/playerStats'
import { useLockBodyScroll } from '../lib/useLockBodyScroll'
import {
  BadgeVotacao, BigCard, SmallCardVotacao, VotingSheet,
  computeWinner, getLastWednesdayId, isVotingOpen
} from '../components/stats/VotacaoComponents'

// ─── Data ──────────────────────────────────────────────────────────────────────

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

async function fetchVotacao(gameId: string) {
  const snap = await getDoc(doc(db, 'votacao', gameId))
  if (!snap.exists()) return { votos: {} as Record<string, { bolaCheia: string; bolaMurcha: string }> }
  return { votos: snap.data().votos ?? {} }
}

async function fetchAllPlayers(): Promise<PlayerInfo[]> {
  const snap = await getDocs(collection(db, 'players'))
  return snap.docs.filter(d => d.data().active !== false).map(d => ({
    id: d.id, name: d.data().name || d.data().email || 'Jogador', photoURL: d.data().photoURL
  }))
}

async function fetchVotacaoHistory(currentGameId: string): Promise<HistoryEntry[]> {
  const [votacaoSnap, allPlayers] = await Promise.all([getDocs(collection(db, 'votacao')), fetchAllPlayers()])
  const playerMap = new Map(allPlayers.map(p => [p.id, p]))
  return votacaoSnap.docs
    .filter(d => d.id !== currentGameId && Object.keys(d.data().votos ?? {}).length > 0)
    .sort((a, b) => b.id.localeCompare(a.id))
    .map(d => {
      const votos = d.data().votos ?? {}
      const cheiaId = computeWinner(votos, 'bolaCheia')
      const murchaId = computeWinner(votos, 'bolaMurcha')
      return { gameId: d.id, cheiaWinner: cheiaId ? (playerMap.get(cheiaId) ?? null) : null, murchaWinner: murchaId ? (playerMap.get(murchaId) ?? null) : null }
    })
    .filter(e => e.cheiaWinner || e.murchaWinner)
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function StatsBolaPage() {
  const user = useAuthStore(s => s.user)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const gameId = getLastWednesdayId()

  const [sheetType, setSheetType] = useState<'bolaCheia' | 'bolaMurcha' | null>(null)
  const [pendingCheia, setPendingCheia] = useState<string | null>(null)
  const [pendingMurcha, setPendingMurcha] = useState<string | null>(null)
  const [isEditingVote, setIsEditingVote] = useState(false)
  const [historySheet, setHistorySheet] = useState<HistoryEntry | null>(null)
  useLockBodyScroll(!!(sheetType || historySheet))
  const [sharing, setSharing] = useState(false)
  const shareCardRef = useRef<HTMLDivElement>(null)
  const historyShareRef = useRef<HTMLDivElement>(null)

  const { data: players = [], isLoading: loadingPlayers } = useQuery({ queryKey: ['confirmed-players', gameId], queryFn: () => fetchConfirmedPlayers(gameId), refetchInterval: 30_000 })
  const { data: votacao, isLoading: loadingVotacao } = useQuery({ queryKey: ['votacao', gameId], queryFn: () => fetchVotacao(gameId), refetchInterval: 10_000 })
  const { data: history = [] } = useQuery({ queryKey: ['votacao-history', gameId], queryFn: () => fetchVotacaoHistory(gameId), staleTime: 5 * 60_000 })

  const saveVote = useMutation({
    mutationFn: async (votes: { bolaCheia: string; bolaMurcha: string }) => {
      const current = votacao ?? { votos: {} }
      await setDoc(doc(db, 'votacao', gameId), { votos: { ...current.votos, [user!.id]: votes } })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['votacao', gameId] }); setIsEditingVote(false); toast.success('Voto registrado!') },
    onError: () => toast.error('Erro ao votar. Tente novamente.')
  })

  const handleSelectVote = (type: 'bolaCheia' | 'bolaMurcha', playerId: string) => {
    if (type === 'bolaCheia') setPendingCheia(playerId)
    else setPendingMurcha(playerId)
    setSheetType(null)
  }

  const shareFromRef = async (ref: React.RefObject<HTMLDivElement>) => {
    if (!ref.current) return
    setSharing(true)
    try {
      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(ref.current, { backgroundColor: '#111827', scale: 2, useCORS: true, logging: false, ignoreElements: el => el.hasAttribute('data-share-exclude') })
      const blob = await new Promise<Blob>((res, rej) => canvas.toBlob(b => b ? res(b) : rej(new Error('null')), 'image/png'))
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
      if (e?.name !== 'AbortError') toast.error('Não foi possível gerar a imagem')
    } finally { setSharing(false) }
  }

  const gameDate = format(new Date(gameId + 'T12:00:00'), "d 'de' MMMM", { locale: ptBR })
  const myVote = votacao?.votos?.[user!.id]
  const hasVoted = !!myVote
  const userWasConfirmed = players.some(p => p.id === user!.id)
  const votingOpen = isVotingOpen()
  const cheiaWinnerId = votacao ? computeWinner(votacao.votos, 'bolaCheia') : null
  const murchaWinnerId = votacao ? computeWinner(votacao.votos, 'bolaMurcha') : null
  const cheiaWinner = players.find(p => p.id === cheiaWinnerId) ?? null
  const murchaWinner = players.find(p => p.id === murchaWinnerId) ?? null
  const pendingCheiaPlayer = players.find(p => p.id === pendingCheia) ?? null
  const pendingMurchaPlayer = players.find(p => p.id === pendingMurcha) ?? null
  const bothSelected = pendingCheia !== null && pendingMurcha !== null
  const votableForCheia = players.filter(p => p.id !== pendingMurcha)
  const votableForMurcha = players.filter(p => p.id !== pendingCheia)

  const HistorySection = () => history.length === 0 ? null : (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 600, fontSize: 16, color: 'var(--color-fg-primary)' }}>Votações antigas</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {history.map(entry => <SmallCardVotacao key={entry.gameId} entry={entry} onClick={() => setHistorySheet(entry)} />)}
      </div>
    </div>
  )

  const HistorySheetEl = historySheet && (
    <>
      <div onClick={() => setHistorySheet(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 70 }} />
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 70, background: 'var(--color-bg)', borderRadius: '24px 24px 0 0', padding: '16px 16px calc(40px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '90dvh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px 4px' }}>
          <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 600, fontSize: 16, color: 'var(--color-fg-primary)' }}>Resultado anterior</p>
          <button onClick={() => setHistorySheet(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><X size={20} color="var(--color-fg-secondary)" /></button>
        </div>
        <BigCard entry={historySheet} cardRef={historyShareRef} onShare={() => shareFromRef(historyShareRef)} sharing={sharing} />
      </div>
    </>
  )

  return (
    <div className="flex flex-col min-h-screen" style={{ background: 'var(--color-bg)', paddingBottom: 'calc(120px + env(safe-area-inset-bottom))' }}>
      {/* Sub-header */}
      <div className="fixed top-0 inset-x-0 z-40" style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 24px' }}>
          <button onClick={() => navigate('/stats')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', marginLeft: -4 }}>
            <CaretLeft size={24} color="var(--color-fg-primary)" weight="bold" />
          </button>
          <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 600, fontSize: 24, color: 'var(--color-fg-primary)', flex: 1, lineHeight: '28px' }}>Bola Cheia/Murcha</p>
        </div>
        <p style={{ fontFamily: 'var(--font-primary)', fontSize: 14, color: 'var(--color-fg-secondary)', padding: '0 24px 12px' }}>Jogo de {gameDate}</p>
      </div>

      <div style={{ height: 84 }} />

      <div className="px-6 flex flex-col gap-6" style={{ paddingTop: 16 }}>
        {loadingPlayers || loadingVotacao ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
            <div className="text-4xl animate-spin">⚽</div>
          </div>
        ) : !votingOpen ? (
          <>
            {cheiaWinnerId || murchaWinnerId ? (
              <BigCard entry={{ cheiaWinner, murchaWinner }} cardRef={shareCardRef} onShare={() => shareFromRef(shareCardRef)} sharing={sharing} />
            ) : (
              <p style={{ textAlign: 'center', padding: '32px 0', fontFamily: 'var(--font-primary)', fontSize: 16, color: 'var(--color-fg-secondary)' }}>
                Votação encerrada. Volte na quarta após o jogo!
              </p>
            )}
            <HistorySection />
          </>
        ) : hasVoted && !isEditingVote ? (
          <>
            <button
              onClick={() => {
                setPendingCheia(myVote.bolaCheia ?? null)
                setPendingMurcha(myVote.bolaMurcha ?? null)
                setIsEditingVote(true)
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', padding: '24px 16px 16px', borderRadius: 24, position: 'relative', overflow: 'hidden', width: '100%', border: 'none', cursor: 'pointer', background: 'transparent', textAlign: 'left' }}
            >
              <img src="/stadium-bg.png" aria-hidden alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', pointerEvents: 'none' }} />
              <img src="/team-blue.png" alt="ChicoFC" style={{ width: 68, height: 68, objectFit: 'contain', flexShrink: 0, position: 'relative' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', textAlign: 'center', position: 'relative' }}>
                <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 600, fontSize: 24, lineHeight: '28px', color: 'white' }}>Parabéns aos envolvidos!</p>
                <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 500, fontSize: 16, color: 'rgba(255,255,255,0.85)' }}>Toque para alterar seu voto</p>
              </div>
              <div style={{ display: 'flex', gap: 12, padding: '0 4px', width: '100%', position: 'relative' }}>
                <BadgeVotacao type="bolaCheia" player={cheiaWinner} disabled completed />
                <BadgeVotacao type="bolaMurcha" player={murchaWinner} disabled completed />
              </div>
            </button>
            <HistorySection />
          </>
        ) : !userWasConfirmed ? (
          <>
            {cheiaWinnerId || murchaWinnerId ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', padding: '24px 16px 16px', borderRadius: 24, position: 'relative', overflow: 'hidden', width: '100%' }}>
                <img src="/stadium-bg.png" aria-hidden alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', pointerEvents: 'none' }} />
                <img src="/team-blue.png" alt="ChicoFC" style={{ width: 68, height: 68, objectFit: 'contain', flexShrink: 0, position: 'relative' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', textAlign: 'center', position: 'relative' }}>
                  <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 600, fontSize: 24, lineHeight: '28px', color: 'white' }}>Parabéns aos envolvidos!</p>
                  <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 500, fontSize: 16, color: 'rgba(255,255,255,0.85)' }}>Vocês foram os escolhidos ao bola cheia e bola murcha da rodada!</p>
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
            <HistorySection />
          </>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '24px 16px 16px', borderRadius: 24, position: 'relative', overflow: 'hidden', width: '100%' }}>
              <img src="/stadium-bg.png" aria-hidden alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', pointerEvents: 'none' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'center', position: 'relative' }}>
                <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 600, fontSize: 24, lineHeight: '28px', color: 'white' }}>Chegou a hora de julgar!</p>
                <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 500, fontSize: 16, color: 'rgba(255,255,255,0.85)' }}>Vote no Bola Cheia e Bola murcha da rodada!</p>
              </div>
              <div style={{ display: 'flex', gap: 12, padding: '16px 4px', position: 'relative' }}>
                <BadgeVotacao type="bolaCheia" player={pendingCheiaPlayer} onClick={() => setSheetType('bolaCheia')} completed />
                <BadgeVotacao type="bolaMurcha" player={pendingMurchaPlayer} onClick={() => setSheetType('bolaMurcha')} completed />
              </div>
              {bothSelected && (
                <button onClick={() => saveVote.mutate({ bolaCheia: pendingCheia!, bolaMurcha: pendingMurcha! })} disabled={saveVote.isPending} className="transition-all active:scale-95 disabled:opacity-40" style={{ width: '100%', height: 56, borderRadius: 9999, background: 'white', color: 'var(--color-fg-accent)', fontFamily: 'var(--font-primary)', fontWeight: 500, fontSize: 16, border: 'none', cursor: 'pointer', position: 'relative', flexShrink: 0 }}>
                  {saveVote.isPending ? 'Salvando...' : 'Confirmar votos'}
                </button>
              )}
            </div>
            {sheetType && <VotingSheet type={sheetType} players={sheetType === 'bolaCheia' ? votableForCheia : votableForMurcha} onClose={() => setSheetType(null)} onVote={id => handleSelectVote(sheetType, id)} />}
            <HistorySection />
          </>
        )}
      </div>
      {HistorySheetEl}
    </div>
  )
}

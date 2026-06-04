import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { doc, getDoc, collection, getDocs } from 'firebase/firestore'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CaretRight, SoccerBall } from '@phosphor-icons/react'
import { useRef } from 'react'
import { db } from '../lib/firebase'
import Header from '../components/layout/Header'
import { fetchFullRanking, type RankingEntry } from '../lib/playerStats'
import { getLastWednesdayId, computeWinner, BigCard } from '../components/stats/VotacaoComponents'
import type { HistoryEntry } from '../lib/playerStats'

// ─── Data ──────────────────────────────────────────────────────────────────────

interface GameEntry { blue: number; yellow: number; date: string }
interface ScoreData { blueWins: number; yellowWins: number; updatedAt: string; history: GameEntry[] }

async function fetchScoreData(): Promise<ScoreData> {
  const snap = await getDoc(doc(db, 'config', 'score'))
  if (!snap.exists()) return { blueWins: 0, yellowWins: 0, updatedAt: '', history: [] }
  const d = snap.data()
  return { blueWins: d.blueWins ?? 0, yellowWins: d.yellowWins ?? 0, updatedAt: d.updatedAt ?? '', history: d.history ?? [] }
}

async function fetchLastVotacaoEntry(currentGameId: string): Promise<HistoryEntry | null> {
  const allPlayers = await getDocs(collection(db, 'players'))
  const playerMap = new Map(allPlayers.docs.map(d => ({ id: d.id, name: d.data().name || d.data().email || 'Jogador', photoURL: d.data().photoURL })).map(p => [p.id, p]))
  const snap = await getDocs(collection(db, 'votacao'))
  const entries = snap.docs
    .filter(d => Object.keys(d.data().votos ?? {}).length > 0)
    .sort((a, b) => b.id.localeCompare(a.id))
  // Preferir jogo atual se tiver votos, senão pegar o mais recente
  const latest = entries[0]
  if (!latest) return null
  const votos = latest.data().votos ?? {}
  const cheiaId = computeWinner(votos, 'bolaCheia')
  const murchaId = computeWinner(votos, 'bolaMurcha')
  return {
    gameId: latest.id,
    cheiaWinner: cheiaId ? (playerMap.get(cheiaId) ?? null) : null,
    murchaWinner: murchaId ? (playerMap.get(murchaId) ?? null) : null,
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ title, onVerMais }: { title: string; onVerMais: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 600, fontSize: 16, color: 'var(--color-fg-primary)' }}>{title}</p>
      <button onClick={onVerMais} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
        <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 500, fontSize: 14, color: 'var(--color-fg-accent)' }}>Ver mais</p>
      </button>
    </div>
  )
}

function Avatar({ name, photoURL, size = 32 }: { name: string; photoURL?: string; size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'var(--color-avatar-bg)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {photoURL ? (
        <img src={photoURL} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <span style={{ color: 'var(--color-avatar-fg)', fontFamily: 'var(--font-primary)', fontSize: size * 0.38, fontWeight: 600 }}>{getInitials(name)}</span>
      )}
    </div>
  )
}

function RankingPreviewRow({ entry, position }: { entry: RankingEntry; position: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 16, height: 64, borderRadius: 24, background: 'var(--color-surface-primary)' }}>
      <span style={{ fontFamily: 'var(--font-primary)', fontWeight: 600, fontSize: 12, color: 'var(--color-fg-primary)', width: 24, textAlign: 'center', flexShrink: 0, lineHeight: '16px' }}>{position}º</span>
      <Avatar name={entry.name} photoURL={entry.photoURL} size={32} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 600, fontSize: 12, color: 'var(--color-fg-primary)', lineHeight: '16px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.name}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
          <span style={{ fontFamily: 'var(--font-primary)', fontSize: 11, color: 'var(--color-fg-primary)' }}>{entry.presences} jogos</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <span style={{ fontFamily: 'var(--font-primary)', fontSize: 11, color: 'var(--color-fg-primary)' }}>{entry.bolaCheiaWins}</span>
            <SoccerBall size={10} color="var(--color-fg-primary)" />
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
        <span style={{ fontFamily: 'var(--font-primary)', fontWeight: 600, fontSize: 16, color: 'var(--color-fg-primary)' }}>{entry.score}</span>
        <span style={{ fontFamily: 'var(--font-primary)', fontSize: 11, color: 'var(--color-fg-primary)' }}>pts</span>
      </div>
      <CaretRight size={20} color="var(--color-fg-secondary)" />
    </div>
  )
}


// ─── Page ──────────────────────────────────────────────────────────────────────

export default function StatsPage() {
  const navigate = useNavigate()
  const gameId = getLastWednesdayId()
  const dummyCardRef = useRef<HTMLDivElement>(null)

  const { data: score } = useQuery({ queryKey: ['score'], queryFn: fetchScoreData, staleTime: 60_000 })
  const { data: ranking = [] } = useQuery({ queryKey: ['full-ranking'], queryFn: fetchFullRanking, staleTime: 5 * 60_000 })
  const { data: lastVotacao } = useQuery({ queryKey: ['last-votacao-entry', gameId], queryFn: () => fetchLastVotacaoEntry(gameId), staleTime: 5 * 60_000 })

  const updatedStr = score?.updatedAt
    ? format(new Date(score.updatedAt), "d 'de' MMMM 'às' HH'h'mm", { locale: ptBR })
    : null

  const recentHistory = (score?.history ?? []).slice(-3).reverse()
  const top3Ranking = ranking.slice(0, 3)

  const votacaoDateLabel = lastVotacao?.gameId
    ? (() => { try { return format(new Date(lastVotacao.gameId + 'T12:00:00'), "d 'de' MMMM", { locale: ptBR }) } catch { return '' } })()
    : null

  return (
    <div className="flex flex-col min-h-screen" style={{ background: 'var(--color-bg)', paddingBottom: 'calc(120px + env(safe-area-inset-bottom))' }}>
      <Header title="Stats" subtitle={updatedStr ? `Atualizado ${updatedStr}` : 'Estatísticas do grupo'} />
      <div style={{ height: 88 }} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '16px 24px 0' }}>

        {/* Card Bola Cheia/Murcha — clicável, navega para a tela completa */}
        <div onClick={() => navigate('/stats/bola-cheia')} style={{ cursor: 'pointer', borderRadius: 24, overflow: 'hidden' }}>
          <BigCard
            entry={{
              cheiaWinner: lastVotacao?.cheiaWinner ?? null,
              murchaWinner: lastVotacao?.murchaWinner ?? null,
              gameId: lastVotacao?.gameId
            }}
            cardRef={dummyCardRef}
          />
        </div>

        {/* Placar Geral */}
        <div>
          <SectionHeader title="Placar Geral" onVerMais={() => navigate('/stats/placar')} />
          <div style={{ background: 'var(--color-surface-primary)', borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Score */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <img src="/team-blue.png" alt="Time Azul" style={{ width: 56, height: 56, objectFit: 'contain' }} />
                <div>
                  <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 700, fontSize: 28, color: 'var(--color-fg-primary)', lineHeight: 1 }}>{String(score?.blueWins ?? 0).padStart(2, '0')}</p>
                  <p style={{ fontFamily: 'var(--font-primary)', fontSize: 12, color: 'var(--color-fg-secondary)', marginTop: 2 }}>Vitórias</p>
                </div>
              </div>
              <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 700, fontSize: 24, color: 'var(--color-fg-secondary)' }}>×</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexDirection: 'row-reverse' }}>
                <img src="/team-yellow.png" alt="Time Preto" style={{ width: 56, height: 56, objectFit: 'contain' }} />
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 700, fontSize: 28, color: 'var(--color-fg-primary)', lineHeight: 1 }}>{String(score?.yellowWins ?? 0).padStart(2, '0')}</p>
                  <p style={{ fontFamily: 'var(--font-primary)', fontSize: 12, color: 'var(--color-fg-secondary)', marginTop: 2 }}>Vitórias</p>
                </div>
              </div>
            </div>

            {/* Histórico recente (3 últimos) */}
            {recentHistory.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ height: 1, background: 'var(--color-border)' }} />
                {recentHistory.map((entry, i) => {
                  const dateStr = (() => { try { return format(new Date(entry.date), 'dd/MM', { locale: ptBR }) } catch { return '—' } })()
                  const blueWon = entry.blue > entry.yellow
                  const yellowWon = entry.yellow > entry.blue
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <img src="/team-blue.png" alt="" style={{ width: 20, height: 20, objectFit: 'contain', flexShrink: 0 }} />
                      <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 700, fontSize: 16, color: blueWon ? 'var(--color-fg-accent)' : 'var(--color-fg-primary)', width: 20, textAlign: 'center' }}>{entry.blue}</p>
                      <p style={{ fontFamily: 'var(--font-primary)', fontSize: 12, color: 'var(--color-fg-secondary)', flex: 1, textAlign: 'center' }}>{dateStr}</p>
                      <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 700, fontSize: 16, color: yellowWon ? '#f59e0b' : 'var(--color-fg-primary)', width: 20, textAlign: 'center' }}>{entry.yellow}</p>
                      <img src="/team-yellow.png" alt="" style={{ width: 20, height: 20, objectFit: 'contain', flexShrink: 0 }} />
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Ranking de Jogadores */}
        <div>
          <SectionHeader title="Ranking de Jogadores" onVerMais={() => navigate('/stats/ranking')} />
          {top3Ranking.length === 0 ? (
            <p style={{ fontFamily: 'var(--font-primary)', fontSize: 14, color: 'var(--color-fg-secondary)', textAlign: 'center', padding: '16px 0' }}>
              Nenhum dado de ranking ainda.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {top3Ranking.map((entry, i) => (
                <RankingPreviewRow key={entry.id} entry={entry} position={i + 1} />
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

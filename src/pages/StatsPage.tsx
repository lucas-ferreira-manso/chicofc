import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { doc, getDoc, collection, getDocs } from 'firebase/firestore'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CaretRight, SoccerBall, X } from '@phosphor-icons/react'
import { db } from '../lib/firebase'
import { useAuthStore } from '../store/authStore'
import Header from '../components/layout/Header'
import { fetchFullRanking, type RankingEntry } from '../lib/playerStats'
import { getLastWednesdayId, computeWinner } from '../components/stats/VotacaoComponents'
import { useLockBodyScroll } from '../lib/useLockBodyScroll'
import type { HistoryEntry, PlayerInfo } from '../lib/playerStats'

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
  const toPlayers = (ids: string[]) => ids.map(id => playerMap.get(id)).filter(Boolean) as PlayerInfo[]
  return {
    gameId: latest.id,
    cheiaWinners: toPlayers(computeWinner(votos, 'bolaCheia')),
    murchaWinners: toPlayers(computeWinner(votos, 'bolaMurcha')),
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

function RankingPreviewRow({ entry, position, onClick }: { entry: RankingEntry; position: number; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 16, height: 64, borderRadius: 24, width: '100%', background: 'var(--color-surface-primary)', border: '1.5px solid transparent', cursor: 'pointer', textAlign: 'left' }}>
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
    </button>
  )
}

function HomeDetailSheet({ entry, position, onClose }: { entry: RankingEntry; position: number; onClose: () => void }) {
  const initials = getInitials(entry.name)
  const stats = [
    { label: 'Vitórias', value: entry.wins },
    { label: 'Empates', value: entry.draws },
    { label: 'Derrotas', value: entry.losses },
    { label: 'Presenças', value: entry.presences },
    { label: 'Bola Cheia', value: entry.bolaCheiaWins },
    { label: 'Bola Murcha', value: entry.bolaMurchaWins },
  ]
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 60 }} />
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 70, background: 'var(--color-bg)', borderRadius: '24px 24px 0 0', padding: '24px 24px calc(40px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ width: 96, height: 96, borderRadius: 20, background: 'var(--color-surface-secondary)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {entry.photoURL ? (
              <img src={entry.photoURL} alt={entry.name} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }} />
            ) : (
              <span style={{ fontFamily: 'var(--font-primary)', fontWeight: 700, fontSize: 32, color: 'var(--color-badge-initials)', opacity: 0.4 }}>{initials}</span>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0, paddingTop: 4 }}>
            <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 600, fontSize: 16, color: 'var(--color-fg-primary)' }}>{entry.name}</p>
            <p style={{ fontFamily: 'var(--font-primary)', fontSize: 12, color: 'var(--color-fg-secondary)', marginTop: 2 }}>{entry.player_type === 'mensalista' ? 'Mensalista' : 'Avulso'}</p>
            <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                  <span style={{ fontFamily: 'var(--font-primary)', fontWeight: 700, fontSize: 24, color: 'var(--color-fg-primary)', lineHeight: 1 }}>{entry.score}</span>
                </div>
                <p style={{ fontFamily: 'var(--font-primary)', fontSize: 11, color: 'var(--color-fg-secondary)', marginTop: 2 }}>pontos</p>
              </div>
              <div>
                <span style={{ fontFamily: 'var(--font-primary)', fontWeight: 700, fontSize: 24, color: 'var(--color-fg-primary)', lineHeight: 1 }}>{position}º</span>
                <p style={{ fontFamily: 'var(--font-primary)', fontSize: 11, color: 'var(--color-fg-secondary)', marginTop: 2 }}>posição</p>
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, flexShrink: 0 }}>
            <X size={20} color="var(--color-fg-secondary)" />
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {stats.map(s => (
            <div key={s.label} style={{ background: 'var(--color-surface-primary)', borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 4, height: 76 }}>
              <p style={{ fontFamily: 'var(--font-primary)', fontSize: 11, color: 'var(--color-fg-secondary)', lineHeight: 1 }}>{s.label}</p>
              <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 700, fontSize: 24, color: 'var(--color-fg-primary)', lineHeight: 1 }}>{s.value}</p>
            </div>
          ))}
        </div>
        <button onClick={onClose} className="transition-all active:scale-95" style={{ width: '100%', height: 56, borderRadius: 9999, background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-fg)', fontFamily: 'var(--font-primary)', fontWeight: 500, fontSize: 16, border: 'none', cursor: 'pointer' }}>
          Fechar
        </button>
      </div>
    </>
  )
}


// ─── Page ──────────────────────────────────────────────────────────────────────

export default function StatsPage() {
  const navigate = useNavigate()
  const user = useAuthStore(s => s.user)
  const gameId = getLastWednesdayId()
  const [selectedRanking, setSelectedRanking] = useState<{ entry: RankingEntry; position: number } | null>(null)
  useLockBodyScroll(!!selectedRanking)

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

        {/* Banner Votação — navega para a tela completa */}
        <div
          onClick={() => navigate('/stats/votacao')}
          style={{
            cursor: 'pointer',
            borderRadius: 16,
            overflow: 'hidden',
            position: 'relative',
            height: 80,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 20px 0 24px',
          }}
        >
          {/* Stadium background */}
          <img
            src="/stadium-bg.png"
            alt=""
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center center',
              pointerEvents: 'none',
            }}
          />
          {/* Dark overlay */}
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.30)', borderRadius: 16 }} />
          {/* Text */}
          <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 600, fontSize: 16, color: '#fff', lineHeight: 1, margin: 0 }}>
              Parabéns aos envolvidos!
            </p>
            <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 600, fontSize: 12, color: 'rgba(255,255,255,0.75)', lineHeight: '16px', margin: 0 }}>
              Confira os destaques do último jogo!
            </p>
          </div>
          {/* Caret */}
          <CaretRight size={20} color="#fff" style={{ position: 'relative', zIndex: 1, flexShrink: 0 }} />
        </div>

        {/* Placar Geral */}
        <div>
          <SectionHeader title="Placar Geral" onVerMais={() => navigate('/stats/placar')} />
          <div style={{ background: 'var(--color-surface-primary)', borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Score — fiel ao Figma: logo + número lado a lado, justify-between */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              {/* Time Azul */}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
                <img src="/team-blue.png" alt="Time Azul" style={{ width: 56, height: 56, objectFit: 'contain', flexShrink: 0 }} />
                <div>
                  <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 600, fontSize: 16, color: 'var(--color-fg-primary)', lineHeight: 1 }}>{String(score?.blueWins ?? 0).padStart(2, '0')}</p>
                  <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 400, fontSize: 11, color: 'var(--color-fg-primary)', textAlign: 'center' }}>Vitórias</p>
                </div>
              </div>
              <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 600, fontSize: 16, color: 'var(--color-fg-primary)' }}>x</p>
              {/* Time Preto */}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 600, fontSize: 16, color: 'var(--color-fg-primary)', lineHeight: 1 }}>{String(score?.yellowWins ?? 0).padStart(2, '0')}</p>
                  <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 400, fontSize: 11, color: 'var(--color-fg-primary)', textAlign: 'center' }}>Vitórias</p>
                </div>
                <img src="/team-yellow.png" alt="Time Preto" style={{ width: 56, height: 56, objectFit: 'contain', flexShrink: 0 }} />
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
                <RankingPreviewRow key={entry.id} entry={entry} position={i + 1} onClick={() => setSelectedRanking({ entry, position: i + 1 })} />
              ))}
            </div>
          )}
        </div>

      </div>

      {selectedRanking && (
        <HomeDetailSheet
          entry={selectedRanking.entry}
          position={selectedRanking.position}
          onClose={() => setSelectedRanking(null)}
        />
      )}
    </div>
  )
}

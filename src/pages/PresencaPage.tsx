import { useQuery } from '@tanstack/react-query'
import Header from '../components/layout/Header'
import { fetchPresenceStats } from '../lib/playerStats'
import type { PlayerPresenceStats } from '../lib/playerStats'

export default function PresencaPage() {
  const { data: stats = [], isLoading } = useQuery({
    queryKey: ['presence-stats'],
    queryFn: fetchPresenceStats,
    staleTime: 5 * 60_000
  })

  return (
    <div className="flex flex-col min-h-full pb-28" style={{ background: 'var(--color-bg)' }}>
      <Header title="Presença" subtitle="Histórico por jogador" />
      <div style={{ height: 96 }} />

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="text-4xl animate-spin">⚽</div>
        </div>
      ) : (
        <div className="px-6 flex flex-col gap-3">
          {stats.map((player, i) => (
            <PresenceCard key={player.id} player={player} rank={i + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

function PresenceCard({ player, rank }: { player: PlayerPresenceStats; rank: number }) {
  const pct = Math.round(player.presenceRate * 100)

  return (
    <div className="flex flex-col gap-3 p-4 rounded-[20px]"
      style={{ background: 'var(--color-surface-primary)' }}>

      <div className="flex items-center gap-3">
        {/* Rank */}
        <span style={{
          fontFamily: 'var(--font-primary)', fontWeight: 700,
          fontSize: 'var(--font-size-16)', color: 'var(--color-fg-secondary)',
          width: 24, textAlign: 'center', flexShrink: 0
        }}>
          {rank}
        </span>

        {/* Avatar */}
        <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 overflow-hidden"
          style={{ background: 'var(--color-avatar-bg)' }}>
          {player.photoURL ? (
            <img src={player.photoURL} alt={player.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{
              color: 'var(--color-avatar-fg)', fontFamily: 'var(--font-primary)',
              fontSize: 'var(--font-size-16)', fontWeight: 700
            }}>
              {player.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
            </span>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate"
            style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)' }}>
            {player.name}
          </p>
          <p style={{ color: 'var(--color-fg-secondary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-12)' }}>
            {player.confirmed} confirmados · {player.totalGames} jogos
          </p>
        </div>

        {/* Taxa */}
        <span style={{
          fontFamily: 'var(--font-primary)', fontWeight: 700,
          fontSize: 'var(--font-size-16)',
          color: pct >= 70 ? 'var(--color-success)' : pct >= 40 ? 'var(--color-warning)' : 'var(--color-danger)'
        }}>
          {pct}%
        </span>
      </div>

      {/* Barra de presença */}
      <div style={{ height: 6, borderRadius: 99, background: 'var(--color-surface-secondary)', overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          borderRadius: 99, transition: 'width 0.4s ease',
          background: pct >= 70 ? 'var(--color-success)' : pct >= 40 ? 'var(--color-warning)' : 'var(--color-danger)'
        }} />
      </div>
    </div>
  )
}

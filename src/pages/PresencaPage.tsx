import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CaretLeft } from '@phosphor-icons/react'
import BadgeRanking from '../components/BadgeRanking'
import { fetchPresenceStats } from '../lib/playerStats'
import type { PlayerPresenceStats } from '../lib/playerStats'

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
}

function ordinal(n: number) { return `${n}º` }

function RankingItem({ player, position }: { player: PlayerPresenceStats; position: number }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      height: 64, padding: 16, borderRadius: 24,
      background: 'var(--color-surface-primary)'
    }}>
      {/* Avatar */}
      <div style={{
        width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
        background: 'var(--color-avatar-bg)', overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        {player.photoURL ? (
          <img src={player.photoURL} alt={player.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{
            fontFamily: 'var(--font-primary)', fontWeight: 500,
            fontSize: 'var(--font-size-14)', color: 'var(--color-avatar-fg)'
          }}>
            {getInitials(player.name)}
          </span>
        )}
      </div>

      {/* Nome */}
      <p style={{
        flex: 1, minWidth: 0,
        fontFamily: 'var(--font-primary)', fontWeight: 500,
        fontSize: 'var(--font-size-16)', color: 'var(--color-fg-primary)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
      }}>
        {player.name}
      </p>

      {/* Posição */}
      <span style={{
        fontFamily: 'var(--font-primary)', fontWeight: 400,
        fontSize: 'var(--font-size-11)', color: 'var(--color-fg-primary)',
        flexShrink: 0
      }}>
        {ordinal(position)}
      </span>
    </div>
  )
}

export default function PresencaPage() {
  const navigate = useNavigate()
  const { data: stats = [], isLoading } = useQuery({
    queryKey: ['presence-stats'],
    queryFn: fetchPresenceStats,
    staleTime: 5 * 60_000
  })

  const top3 = stats.slice(0, 3)
  // Podium: 2º esquerda, 1º centro, 3º direita
  const podium = [top3[1] ?? null, top3[0] ?? null, top3[2] ?? null]
  const rest = stats.slice(3)

  return (
    <div className="flex flex-col min-h-full pb-28" style={{ background: 'var(--color-bg)' }}>

      {/* Header com back button */}
      <div className="fixed top-0 inset-x-0 z-40" style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
        <div className="flex items-center gap-2 px-6 py-4">
          <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}>
            <CaretLeft size={24} color="var(--color-fg-primary)" />
          </button>
          <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 600, fontSize: 'var(--font-size-24)', lineHeight: '28px', color: 'var(--color-fg-primary)' }}>
            Ranking
          </p>
        </div>
      </div>
      <div style={{ height: 80 }} />

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
          <div className="text-4xl animate-spin">⚽</div>
        </div>
      ) : (
        <div className="px-6 flex flex-col gap-4">

          {/* Seção */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 8 }}>
            <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 600, fontSize: 'var(--font-size-16)', color: 'var(--color-fg-primary)' }}>
              Top 3 mais presentes
            </p>

            {/* Podium */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <BadgeRanking player={podium[0]} rank={2} />
              <BadgeRanking player={podium[1]} rank={1} />
              <BadgeRanking player={podium[2]} rank={3} />
            </div>

            {/* Lista 4º em diante */}
            {rest.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                {rest.map((player, i) => (
                  <RankingItem key={player.id} player={player} position={i + 4} />
                ))}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  )
}

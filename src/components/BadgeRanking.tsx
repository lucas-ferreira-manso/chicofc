import type { PlayerPresenceStats, PlayerVotingStats } from '../lib/playerStats'

type RankingPlayer = Pick<PlayerPresenceStats | PlayerVotingStats, 'id' | 'name' | 'photoURL'>

interface BadgeRankingProps {
  player: RankingPlayer | null
  rank: 1 | 2 | 3
}

const MEDAL = {
  1: { bg: 'var(--color-surface-gold)', fg: '#1a1a1a', label: '1º' },
  2: { bg: 'var(--color-surface-silver)', fg: '#1a1a1a', label: '2º' },
  3: { bg: 'var(--color-surface-bronze)', fg: '#ffffff', label: '3º' },
} as const

export default function BadgeRanking({ player, rank }: BadgeRankingProps) {
  const medal = MEDAL[rank]
  const initials = player
    ? player.name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
    : '?'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'center', width: 110, position: 'relative' }}>
      {/* Foto */}
      <div style={{
        width: 110, height: 110, borderRadius: 24,
        background: 'var(--color-surface-secondary)',
        overflow: 'hidden', position: 'relative', flexShrink: 0
      }}>
        {player?.photoURL ? (
          <img
            src={player.photoURL} alt={player.name}
            style={{
              position: 'absolute', width: 124, height: 124,
              top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              objectFit: 'cover', pointerEvents: 'none'
            }}
          />
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{
              fontFamily: 'var(--font-primary)', fontWeight: 700,
              fontSize: 32, color: 'var(--color-avatar-fg)', opacity: 0.5
            }}>
              {initials}
            </span>
          </div>
        )}
      </div>

      {/* Nome */}
      <p style={{
        fontFamily: 'var(--font-primary)', fontWeight: 500,
        fontSize: 'var(--font-size-14)', color: 'var(--color-fg-primary)',
        textAlign: 'center', width: '100%'
      }}>
        {player?.name ?? '—'}
      </p>

      {/* Medalha — sobrepõe foto e nome */}
      <div style={{
        position: 'absolute', top: 86, left: '50%', transform: 'translateX(-50%)',
        width: 44, height: 44, borderRadius: '50%',
        border: '2px solid var(--color-bg)',
        background: medal.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, zIndex: 1
      }}>
        <span style={{
          fontFamily: 'var(--font-primary)', fontWeight: 500,
          fontSize: 'var(--font-size-18)', color: medal.fg,
          textAlign: 'center'
        }}>
          {medal.label}
        </span>
      </div>
    </div>
  )
}

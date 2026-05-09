import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CaretLeft } from '@phosphor-icons/react'
import { fetchLastGamePlayers } from '../lib/playerStats'
import type { PlayerPresenceStats } from '../lib/playerStats'

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
}

function PlayerItem({ player, position }: { player: PlayerPresenceStats; position: number }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      height: 64, padding: 16, borderRadius: 24,
      background: 'var(--color-surface-primary)'
    }}>
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

      <p style={{
        flex: 1, minWidth: 0,
        fontFamily: 'var(--font-primary)', fontWeight: 500,
        fontSize: 'var(--font-size-16)', color: 'var(--color-fg-primary)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
      }}>
        {player.name}
      </p>

      <span style={{
        fontFamily: 'var(--font-primary)', fontWeight: 400,
        fontSize: 'var(--font-size-11)', color: 'var(--color-fg-secondary)',
        flexShrink: 0
      }}>
        {position}
      </span>
    </div>
  )
}

export default function PresencaPage() {
  const navigate = useNavigate()
  const { data: players = [], isLoading } = useQuery({
    queryKey: ['last-game-players'],
    queryFn: fetchLastGamePlayers,
    staleTime: 5 * 60_000
  })

  return (
    <div className="flex flex-col min-h-full pb-28" style={{ background: 'var(--color-bg)' }}>

      <div className="fixed top-0 inset-x-0 z-40" style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
        <div className="flex items-center gap-2 px-6 py-4">
          <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}>
            <CaretLeft size={24} color="var(--color-fg-primary)" />
          </button>
          <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 600, fontSize: 'var(--font-size-24)', lineHeight: '28px', color: 'var(--color-fg-primary)' }}>
            Presença
          </p>
        </div>
      </div>
      <div style={{ height: 80 }} />

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
          <div className="text-4xl animate-spin">⚽</div>
        </div>
      ) : players.length === 0 ? (
        <p style={{
          textAlign: 'center', padding: '48px 24px',
          fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)',
          color: 'var(--color-fg-secondary)'
        }}>
          Nenhuma presença registrada ainda.
        </p>
      ) : (
        <div className="px-6" style={{ paddingTop: 8 }}>
          <p style={{
            fontFamily: 'var(--font-primary)', fontWeight: 600,
            fontSize: 'var(--font-size-16)', color: 'var(--color-fg-primary)',
            marginBottom: 16
          }}>
            Último jogo — {players.length} presentes
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {players.map((player, i) => (
              <PlayerItem key={player.id} player={player} position={i + 1} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

import { useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { X } from '@phosphor-icons/react'
import type { PlayerInfo, HistoryEntry } from '../../lib/playerStats'

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
}

export function computeWinner(
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

export function getLastWednesdayId(): string {
  const today = new Date()
  const daysBack = (today.getDay() - 3 + 7) % 7
  const d = new Date(today)
  d.setDate(today.getDate() - daysBack)
  return format(d, 'yyyy-MM-dd')
}

export function isVotingOpen(): boolean {
  const day = new Date().getDay()
  return day !== 1 && day !== 2
}

// ─── Bola Icons ───────────────────────────────────────────────────────────────

export function BolaCheiaIcon({ size = 52 }: { size?: number }) {
  return (
    <div style={{ width: size, height: size, flexShrink: 0, pointerEvents: 'none' }}>
      <img src="/bola-cheia.png" alt="Bola Cheia" style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }} />
    </div>
  )
}

export function BolaMurchaIcon({ size = 52 }: { size?: number }) {
  return (
    <div style={{ width: size, height: size, flexShrink: 0, pointerEvents: 'none' }}>
      <img src="/bola-murcha.png" alt="Bola Murcha" style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }} />
    </div>
  )
}

// ─── Player Avatar ────────────────────────────────────────────────────────────

export function PlayerAvatar({ player, size = 32 }: { player: PlayerInfo; size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'var(--color-avatar-bg)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {player.photoURL ? (
        <img src={player.photoURL} alt={player.name} crossOrigin="anonymous" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <span style={{ color: 'var(--color-avatar-fg)', fontFamily: 'var(--font-primary)', fontSize: size * 0.38, fontWeight: 600 }}>
          {getInitials(player.name)}
        </span>
      )}
    </div>
  )
}

// ─── Badge Votação ────────────────────────────────────────────────────────────

interface BadgeProps {
  type: 'bolaCheia' | 'bolaMurcha'
  player?: PlayerInfo | null
  onClick?: () => void
  disabled?: boolean
  completed?: boolean
}

export function BadgeVotacao({ type, player, onClick, disabled, completed }: BadgeProps) {
  const isMurcha = type === 'bolaMurcha'
  const accentColor = completed ? 'white' : isMurcha ? '#ed0000' : 'var(--color-fg-accent)'
  const nameColor = completed ? 'rgba(255,255,255,0.8)' : 'var(--color-fg-secondary)'
  const label = isMurcha ? 'Bola Murcha' : 'Bola Cheia'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 133, position: 'relative' }}>
      <button onClick={onClick} disabled={disabled || !onClick} style={{
        aspectRatio: '1/1', borderRadius: 24, width: '100%',
        background: player ? 'var(--color-surface-secondary)' : 'white',
        border: player ? 'none' : '1.5px solid var(--color-border)',
        overflow: 'hidden', position: 'relative',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: (disabled || !onClick) ? 'default' : 'pointer', padding: 0
      }}>
        {player ? (
          player.photoURL ? (
            <img src={player.photoURL} alt={player.name} crossOrigin="anonymous" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', display: 'block', pointerEvents: 'none' }} />
          ) : (
            <span style={{ fontFamily: 'var(--font-primary)', fontWeight: 700, fontSize: 48, color: 'var(--color-badge-initials)', opacity: 0.4 }}>
              {getInitials(player.name)}
            </span>
          )
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M12 5V19M5 12H19" stroke={accentColor} strokeWidth="2" strokeLinecap="round" />
          </svg>
        )}
      </button>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontFamily: 'var(--font-primary)', fontWeight: 700, fontSize: 18, lineHeight: '18px', color: accentColor }}>
          {label}
        </span>
        <span style={{ fontFamily: 'var(--font-primary)', fontWeight: 500, fontSize: 14, color: nameColor }}>
          {player ? player.name : 'nome atleta'}
        </span>
      </div>
      <div style={{ position: 'absolute', right: -3, bottom: 40, pointerEvents: 'none' }}>
        {isMurcha ? <BolaMurchaIcon size={52} /> : <BolaCheiaIcon size={52} />}
      </div>
    </div>
  )
}

// ─── Small Card Votação (histórico grid) ──────────────────────────────────────

export function SmallCardVotacao({ entry, onClick }: { entry: HistoryEntry; onClick: () => void }) {
  const dateLabel = (() => {
    try { return format(new Date(entry.gameId + 'T12:00:00'), 'dd/MM/yyyy') } catch { return entry.gameId }
  })()

  const MiniPhoto = ({ player }: { player: PlayerInfo | null }) => (
    <div style={{ width: 63, height: 71, borderRadius: 16, overflow: 'hidden', flexShrink: 0, background: 'var(--color-surface-secondary)', position: 'relative' }}>
      {player?.photoURL ? (
        <img src={player.photoURL} alt={player.name} crossOrigin="anonymous" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', display: 'block' }} />
      ) : player ? (
        <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-primary)', fontWeight: 700, fontSize: 22, color: 'var(--color-badge-initials)', opacity: 0.5 }}>
          {getInitials(player.name)}
        </span>
      ) : null}
    </div>
  )

  return (
    <button onClick={onClick} style={{ width: 164, borderRadius: 24, overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '12px 8px 8px', border: 'none', cursor: 'pointer', background: 'transparent' }}>
      <img src="/stadium-bg.png" aria-hidden alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', pointerEvents: 'none' }} />
      <img src="/team-blue.png" alt="" style={{ width: 32, height: 32, objectFit: 'contain', position: 'relative', flexShrink: 0 }} />
      <div style={{ width: '100%', position: 'relative', textAlign: 'center' }}>
        <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 600, fontSize: 12, lineHeight: '16px', color: 'white' }}>Bola Cheia/Murcha</p>
        <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 400, fontSize: 11, color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>Pelada dia {dateLabel}</p>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, width: '100%', position: 'relative', padding: '0 4px' }}>
        <div style={{ position: 'relative' }}>
          <MiniPhoto player={entry.cheiaWinner} />
          <div style={{ position: 'absolute', right: -1.4, top: 48, pointerEvents: 'none' }}><BolaCheiaIcon size={24} /></div>
        </div>
        <div style={{ position: 'relative' }}>
          <MiniPhoto player={entry.murchaWinner} />
          <div style={{ position: 'absolute', right: -1.4, top: 48, pointerEvents: 'none' }}><BolaMurchaIcon size={24} /></div>
        </div>
      </div>
    </button>
  )
}

// ─── Voting Sheet ──────────────────────────────────────────────────────────────

interface VotingSheetProps {
  type: 'bolaCheia' | 'bolaMurcha'
  players: PlayerInfo[]
  onClose: () => void
  onVote: (playerId: string) => void
}

export function VotingSheet({ type, players, onClose, onVote }: VotingSheetProps) {
  const [selected, setSelected] = useState<string | null>(null)
  const isMurcha = type === 'bolaMurcha'
  const accentColor = isMurcha ? '#ed0000' : 'var(--color-fg-accent)'

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end' }} onClick={onClose}>
      <div style={{ width: '100%', background: 'var(--color-bg)', borderRadius: '24px 24px 0 0', padding: '24px 24px 40px', maxHeight: '82vh', display: 'flex', flexDirection: 'column', gap: 24 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: 'var(--font-primary)', fontWeight: 600, fontSize: 16, color: 'var(--color-fg-primary)' }}>
            {isMurcha ? 'Vote no Bola Murcha' : 'Vote no Bola Cheia'}
          </span>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 16, background: 'var(--color-surface-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
            <X size={16} color="var(--color-fg-secondary)" />
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', flex: 1 }}>
          {players.map(player => (
            <button key={player.id} onClick={() => setSelected(player.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 16, borderRadius: 24, width: '100%', background: 'var(--color-surface-primary)', border: selected === player.id ? `2px solid ${accentColor}` : '2px solid transparent', cursor: 'pointer', transition: 'border-color 0.15s' }}>
              <PlayerAvatar player={player} size={32} />
              <span style={{ fontFamily: 'var(--font-primary)', fontWeight: 500, fontSize: 16, color: 'var(--color-fg-primary)' }}>{player.name}</span>
            </button>
          ))}
        </div>
        <button onClick={() => selected && onVote(selected)} disabled={!selected} style={{ width: '100%', height: 56, borderRadius: 9999, background: selected ? accentColor : 'var(--color-surface-secondary)', color: selected ? 'white' : 'var(--color-fg-secondary)', fontFamily: 'var(--font-primary)', fontWeight: 500, fontSize: 16, border: 'none', cursor: selected ? 'pointer' : 'default', flexShrink: 0, transition: 'background 0.15s, color 0.15s' }}>
          Votar
        </button>
      </div>
    </div>
  )
}

// ─── Big Card (resultado da votação) ──────────────────────────────────────────

interface BigCardProps {
  entry: { cheiaWinner: PlayerInfo | null; murchaWinner: PlayerInfo | null; gameId?: string }
  cardRef: React.RefObject<HTMLDivElement>
  onShare?: () => void
  sharing?: boolean
}

export function BigCard({ entry, cardRef, onShare, sharing }: BigCardProps) {
  const dateLabel = entry.gameId
    ? (() => { try { return format(new Date(entry.gameId + 'T12:00:00'), "d 'de' MMMM", { locale: ptBR }) } catch { return '' } })()
    : null

  return (
    <div ref={cardRef} style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', padding: '24px 16px 16px', borderRadius: 24, position: 'relative', overflow: 'hidden', ...(onShare ? {} : { aspectRatio: '1/1' }), width: '100%' }}>
      <img src="/stadium-bg.png" aria-hidden alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', pointerEvents: 'none' }} />
      <img src="/team-blue.png" alt="ChicoFC" style={{ width: 68, height: 68, objectFit: 'contain', flexShrink: 0, position: 'relative' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', textAlign: 'center', position: 'relative' }}>
        <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 600, fontSize: 24, lineHeight: '28px', color: 'white' }}>Parabéns aos envolvidos!</p>
        <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 500, fontSize: 16, color: 'rgba(255,255,255,0.85)' }}>
          {dateLabel ? `Pelada dia ${format(new Date(entry.gameId! + 'T12:00:00'), 'dd/MM/yyyy')}` : 'Vocês foram os escolhidos ao bola cheia e bola murcha da rodada!'}
        </p>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 8px', width: '100%', alignItems: 'center', position: 'relative', flex: 1 }}>
        <BadgeVotacao type="bolaCheia" player={entry.cheiaWinner} disabled completed />
        <BadgeVotacao type="bolaMurcha" player={entry.murchaWinner} disabled completed />
      </div>
      {onShare && (
        <button data-share-exclude onClick={onShare} disabled={sharing} style={{ width: '100%', height: 56, borderRadius: 9999, background: 'white', border: 'none', color: 'var(--color-fg-accent)', fontFamily: 'var(--font-primary)', fontWeight: 500, fontSize: 16, cursor: sharing ? 'default' : 'pointer', position: 'relative', flexShrink: 0, opacity: sharing ? 0.7 : 1 }}>
          {sharing ? 'Gerando imagem...' : 'Compartilhar'}
        </button>
      )}
    </div>
  )
}

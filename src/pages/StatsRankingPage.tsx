import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CaretLeft, CaretRight, Info, SoccerBall, X } from '@phosphor-icons/react'
import { useAuthStore } from '../store/authStore'
import { fetchFullRanking, type RankingEntry } from '../lib/playerStats'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
}

// ─── Badge Ranking (Figma: 90×90 photo, 175px tall, medal at top-73) ─────────

function BadgeRankingFigma({ entry, rank }: { entry: RankingEntry | null; rank: 1 | 2 | 3 }) {
  const MEDAL = {
    1: { bg: 'var(--color-surface-gold, #fad026)', fg: 'var(--color-fg-primary)', label: '1º' },
    2: { bg: 'var(--color-surface-silver, #e9e3cc)', fg: 'var(--color-fg-primary)', label: '2º' },
    3: { bg: 'var(--color-surface-bronze, #bb9a15)', fg: 'white', label: '3º' },
  }
  const medal = MEDAL[rank]
  const initials = entry ? getInitials(entry.name) : '?'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 175, alignItems: 'center', justifyContent: 'space-between', position: 'relative', width: 90 }}>
      {/* Foto */}
      <div style={{ width: 90, height: 90, borderRadius: 24, background: 'var(--color-surface-secondary)', overflow: 'hidden', position: 'relative', flexShrink: 0 }}>
        {entry?.photoURL ? (
          <img src={entry.photoURL} alt={entry.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: 'var(--font-primary)', fontWeight: 700, fontSize: 28, color: 'var(--color-badge-initials)', opacity: 0.4 }}>{initials}</span>
          </div>
        )}
        {/* Medalha sobreposta à foto */}
        <div style={{ position: 'absolute', bottom: -22, left: '50%', transform: 'translateX(-50%)', width: 44, height: 44, borderRadius: '50%', border: '2px solid var(--color-bg)', background: medal.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
          <span style={{ fontFamily: 'var(--font-primary)', fontWeight: 500, fontSize: 18, color: medal.fg, lineHeight: 1 }}>{medal.label}</span>
        </div>
      </div>
      {/* Nome + Pontos */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: '100%', paddingTop: 30 }}>
        <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 600, fontSize: 12, color: 'var(--color-fg-primary)', textAlign: 'center', lineHeight: '16px', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {entry?.name ?? '—'}
        </p>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
          <span style={{ fontFamily: 'var(--font-primary)', fontWeight: 600, fontSize: 12, color: 'var(--color-fg-primary)' }}>{entry?.score ?? 0}</span>
          <span style={{ fontFamily: 'var(--font-primary)', fontWeight: 400, fontSize: 11, color: 'var(--color-fg-secondary)' }}>pts</span>
        </div>
      </div>
    </div>
  )
}

// ─── Player Row ───────────────────────────────────────────────────────────────

function RankingRow({ entry, position, isMe, onClick }: { entry: RankingEntry; position: number; isMe: boolean; onClick: () => void }) {
  const initials = getInitials(entry.name)
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 16, height: 64, borderRadius: 24, width: '100%', background: 'var(--color-surface-primary)', border: isMe ? '1.5px solid var(--color-fg-accent-light)' : '1.5px solid transparent', cursor: 'pointer', textAlign: 'left' }}>
      <span style={{ fontFamily: 'var(--font-primary)', fontWeight: 600, fontSize: 12, color: 'var(--color-fg-primary)', width: 24, textAlign: 'center', flexShrink: 0, lineHeight: '16px' }}>
        {position}º
      </span>
      {/* Avatar */}
      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--color-avatar-bg)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {entry.photoURL ? (
          <img src={entry.photoURL} alt={entry.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ color: 'var(--color-avatar-fg)', fontFamily: 'var(--font-primary)', fontSize: 12, fontWeight: 600 }}>{initials}</span>
        )}
      </div>
      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 600, fontSize: 12, color: 'var(--color-fg-primary)', lineHeight: '16px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {entry.name}{isMe && <span style={{ color: 'var(--color-fg-secondary)', fontWeight: 400 }}> (você)</span>}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
          <span style={{ fontFamily: 'var(--font-primary)', fontWeight: 400, fontSize: 11, color: 'var(--color-fg-primary)' }}>{entry.presences} jogos</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <span style={{ fontFamily: 'var(--font-primary)', fontWeight: 400, fontSize: 11, color: 'var(--color-fg-primary)' }}>{entry.bolaCheiaWins}</span>
            <SoccerBall size={10} color="var(--color-fg-primary)" />
          </div>
        </div>
      </div>
      {/* Pontos */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 1, flexShrink: 0 }}>
        <span style={{ fontFamily: 'var(--font-primary)', fontWeight: 600, fontSize: 16, color: 'var(--color-fg-primary)' }}>{entry.score}</span>
        <span style={{ fontFamily: 'var(--font-primary)', fontWeight: 400, fontSize: 11, color: 'var(--color-fg-primary)' }}>pts</span>
      </div>
      <CaretRight size={20} color="var(--color-fg-secondary)" />
    </button>
  )
}

// ─── Detail Bottom Sheet ───────────────────────────────────────────────────────

function DetailSheet({ entry, position, onClose }: { entry: RankingEntry; position: number; onClose: () => void }) {
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

        {/* Header do sheet */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          {/* Foto 96×96 */}
          <div style={{ width: 96, height: 96, borderRadius: 20, background: 'var(--color-surface-secondary)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {entry.photoURL ? (
              <img src={entry.photoURL} alt={entry.name} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }} />
            ) : (
              <span style={{ fontFamily: 'var(--font-primary)', fontWeight: 700, fontSize: 32, color: 'var(--color-badge-initials)', opacity: 0.4 }}>{initials}</span>
            )}
          </div>
          {/* Info */}
          <div style={{ flex: 1, minWidth: 0, paddingTop: 4 }}>
            <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 600, fontSize: 16, color: 'var(--color-fg-primary)', lineHeight: '20px' }}>{entry.name}</p>
            <p style={{ fontFamily: 'var(--font-primary)', fontSize: 12, color: 'var(--color-fg-secondary)', marginTop: 2 }}>
              {entry.player_type === 'mensalista' ? 'Mensalista' : 'Avulso'}
            </p>
            <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                  <span style={{ fontFamily: 'var(--font-primary)', fontWeight: 700, fontSize: 24, color: 'var(--color-fg-primary)', lineHeight: 1 }}>{entry.score}</span>
                </div>
                <p style={{ fontFamily: 'var(--font-primary)', fontSize: 11, color: 'var(--color-fg-secondary)', marginTop: 2 }}>pontos</p>
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                  <span style={{ fontFamily: 'var(--font-primary)', fontWeight: 700, fontSize: 24, color: 'var(--color-fg-primary)', lineHeight: 1 }}>{position}º</span>
                </div>
                <p style={{ fontFamily: 'var(--font-primary)', fontSize: 11, color: 'var(--color-fg-secondary)', marginTop: 2 }}>posição</p>
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, flexShrink: 0 }}>
            <X size={20} color="var(--color-fg-secondary)" />
          </button>
        </div>

        {/* Grid de stats 3×2 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {stats.map(s => (
            <div key={s.label} style={{ background: 'var(--color-surface-primary)', borderRadius: 16, padding: '16px', display: 'flex', flexDirection: 'column', gap: 4, height: 76 }}>
              <p style={{ fontFamily: 'var(--font-primary)', fontSize: 11, color: 'var(--color-fg-secondary)', lineHeight: 1 }}>{s.label}</p>
              <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 700, fontSize: 24, color: 'var(--color-fg-primary)', lineHeight: 1 }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Botão ver perfil */}
        <button onClick={onClose} className="transition-all active:scale-95" style={{ width: '100%', height: 56, borderRadius: 9999, background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-fg)', fontFamily: 'var(--font-primary)', fontWeight: 500, fontSize: 16, border: 'none', cursor: 'pointer' }}>
          Fechar
        </button>
      </div>
    </>
  )
}

// ─── Formula Bottom Sheet ─────────────────────────────────────────────────────

function FormulaSheet({ onClose }: { onClose: () => void }) {
  const items = [
    { label: 'Vitória', value: '+3 pts', desc: 'Por jogo ganho' },
    { label: 'Empate', value: '+1 pt', desc: 'Por jogo empatado' },
    { label: 'Derrota', value: '0 pts', desc: 'Por jogo perdido' },
    { label: 'Presença', value: '+1 pt', desc: 'Por jogo confirmado' },
    { label: 'Bola Cheia', value: '+5 pts', desc: 'Eleito melhor da rodada' },
    { label: 'Bola Murcha', value: '-2 pts', desc: 'Eleito pior da rodada' },
  ]

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 60 }} />
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 70, background: 'var(--color-bg)', borderRadius: '24px 24px 0 0', padding: '24px 24px calc(40px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 600, fontSize: 18, color: 'var(--color-fg-primary)' }}>Como a pontuação é calculada</p>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <X size={20} color="var(--color-fg-secondary)" />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', background: 'var(--color-surface-primary)', borderRadius: 16, gap: 12 }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 500, fontSize: 14, color: 'var(--color-fg-primary)' }}>{item.label}</p>
                <p style={{ fontFamily: 'var(--font-primary)', fontSize: 12, color: 'var(--color-fg-secondary)', marginTop: 2 }}>{item.desc}</p>
              </div>
              <span style={{ fontFamily: 'var(--font-primary)', fontWeight: 700, fontSize: 15, color: item.value.startsWith('-') ? '#ef4444' : item.value === '0 pts' ? 'var(--color-fg-secondary)' : '#089527', flexShrink: 0 }}>
                {item.value}
              </span>
            </div>
          ))}
        </div>

        <div style={{ background: 'var(--color-surface-primary)', borderRadius: 16, padding: '14px 16px' }}>
          <p style={{ fontFamily: 'var(--font-primary)', fontSize: 12, color: 'var(--color-fg-secondary)', lineHeight: 1.6 }}>
            <span style={{ fontWeight: 600, color: 'var(--color-fg-primary)' }}>Fórmula: </span>
            V×3 + E×1 + Presenças×1 + Bola Cheia×5 − Bola Murcha×2
          </p>
        </div>
      </div>
    </>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function StatsRankingPage() {
  const user = useAuthStore(s => s.user)
  const navigate = useNavigate()
  const [selected, setSelected] = useState<{ entry: RankingEntry; position: number } | null>(null)
  const [showFormula, setShowFormula] = useState(false)

  const { data: ranking = [], isLoading } = useQuery({
    queryKey: ['full-ranking'],
    queryFn: fetchFullRanking,
    staleTime: 5 * 60_000
  })

  const top3 = ranking.slice(0, 3)
  // Pódio: 2º | 1º | 3º (visual order)
  const podium: [RankingEntry | null, RankingEntry | null, RankingEntry | null] = [
    top3[1] ?? null,
    top3[0] ?? null,
    top3[2] ?? null
  ]
  const podiumRanks: [2, 1, 3] = [2, 1, 3]

  return (
    <div className="flex flex-col min-h-screen" style={{ background: 'var(--color-bg)', paddingBottom: 'calc(120px + env(safe-area-inset-bottom))' }}>

      {/* Header fixo */}
      <div className="fixed top-0 inset-x-0 z-40" style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 24px' }}>
          <button onClick={() => navigate('/stats')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
            <CaretLeft size={24} color="var(--color-fg-primary)" weight="bold" />
          </button>
          <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 600, fontSize: 24, color: 'var(--color-fg-primary)', flex: 1, lineHeight: '28px' }}>Ranking</p>
          <button onClick={() => setShowFormula(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
            <Info size={24} color="var(--color-fg-primary)" />
          </button>
        </div>
      </div>

      <div style={{ height: 60 }} />

      {/* Conteúdo */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '16px 24px 0' }}>

        {/* Card votação — banner */}
        <button onClick={() => navigate('/stats/bola-cheia')} style={{ borderRadius: 16, overflow: 'hidden', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 24, paddingRight: 16, paddingTop: 20, paddingBottom: 20, border: 'none', cursor: 'pointer', background: 'transparent', width: '100%' }}>
          <img src="/stadium-bg.png" aria-hidden alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', pointerEvents: 'none' }} />
          <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 600, fontSize: 16, color: 'white', position: 'relative', textAlign: 'left', maxWidth: 224 }}>
            Confira a lista dos Bola Cheia e Bola murcha.
          </p>
          <CaretRight size={20} color="white" style={{ position: 'relative', flexShrink: 0 }} />
        </button>

        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
            <div className="text-4xl animate-spin">⚽</div>
          </div>
        ) : ranking.length === 0 ? (
          <p style={{ textAlign: 'center', padding: '48px 0', fontFamily: 'var(--font-primary)', fontSize: 16, color: 'var(--color-fg-secondary)' }}>
            Nenhum dado disponível ainda.
          </p>
        ) : (
          <>
            {/* Pódio top 3 */}
            {top3.length >= 1 && (
              <div style={{ background: 'var(--color-surface-primary)', borderRadius: 16, padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                  {podium.map((entry, i) => (
                    <div key={i} onClick={() => entry && setSelected({ entry, position: ranking.indexOf(entry) + 1 })} style={{ cursor: entry ? 'pointer' : 'default' }}>
                      <BadgeRankingFigma entry={entry} rank={podiumRanks[i]} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Lista completa */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {ranking.map((entry, i) => (
                <RankingRow
                  key={entry.id}
                  entry={entry}
                  position={i + 1}
                  isMe={entry.id === user?.id}
                  onClick={() => setSelected({ entry, position: i + 1 })}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {selected && <DetailSheet entry={selected.entry} position={selected.position} onClose={() => setSelected(null)} />}
      {showFormula && <FormulaSheet onClose={() => setShowFormula(false)} />}
    </div>
  )
}

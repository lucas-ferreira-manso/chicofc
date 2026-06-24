import { useState } from 'react'
import { SoccerBall, ChartBar, PiggyBank, ShieldStar, User, X } from '@phosphor-icons/react'

// ─── PreviewBox ───────────────────────────────────────────────────────────────
// Container padrão para cada preview de componente

function PreviewBox({
  label, description, children, dark = false
}: {
  label: string
  description?: string
  children: React.ReactNode
  dark?: boolean
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontFamily: 'var(--font-primary)', fontWeight: 500, fontSize: 14, color: 'var(--color-fg-primary)' }}>
          {label}
        </span>
        {description && (
          <span style={{ fontFamily: 'var(--font-primary)', fontSize: 12, color: 'var(--color-fg-secondary)' }}>
            {description}
          </span>
        )}
      </div>
      <div style={{
        borderRadius: 20,
        border: '1px solid var(--color-border)',
        background: dark ? '#1a1a1a' : 'var(--color-surface-primary)',
        overflow: 'hidden',
        padding: 20,
      }}>
        {children}
      </div>
    </div>
  )
}

// ─── Header Preview ───────────────────────────────────────────────────────────

export function HeaderPreview() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PreviewBox label="Default" description="Título + subtítulo">
        <div style={{
          background: 'var(--color-bg)',
          borderBottom: '1px solid var(--color-border)',
          borderRadius: 12, padding: '16px 24px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 600, fontSize: 24, lineHeight: '28px', color: 'var(--color-fg-primary)', margin: 0 }}>
              Stats
            </p>
          </div>
          <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 500, fontSize: 16, color: 'var(--color-fg-secondary)', marginTop: 8, marginBottom: 0, lineHeight: 1 }}>
            Jogo de 18 de junho
          </p>
        </div>
      </PreviewBox>

      <PreviewBox label="Com ação" description="Título + rightContent">
        <div style={{
          background: 'var(--color-bg)',
          borderBottom: '1px solid var(--color-border)',
          borderRadius: 12, padding: '16px 24px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 600, fontSize: 24, lineHeight: '28px', color: 'var(--color-fg-primary)', margin: 0 }}>
              Jogadores
            </p>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 4,
              height: 24, padding: '1px 8px',
              background: 'var(--color-surface-primary)',
              border: '1px solid var(--color-border)',
              borderRadius: 16
            }}>
              <span style={{ fontFamily: 'var(--font-primary)', fontSize: 11, fontWeight: 400, color: 'var(--color-fg-primary)', lineHeight: 1 }}>
                Modo Chinelinho
              </span>
              <span style={{ fontSize: 14, lineHeight: 1 }}>🩴</span>
            </div>
          </div>
        </div>
      </PreviewBox>
    </div>
  )
}

// ─── Bottom Nav Preview ───────────────────────────────────────────────────────

export function BottomNavPreview() {
  const [active, setActive] = useState('/games')
  const tabs = [
    { to: '/games',    Icon: SoccerBall, label: 'Jogo'     },
    { to: '/stats',    Icon: ChartBar,   label: 'Stats'    },
    { to: '/caixinha', Icon: PiggyBank,  label: 'Caixinha' },
    { to: '/admin',    Icon: ShieldStar, label: 'Admin'    },
    { to: '/profile',  Icon: User,       label: 'Perfil'   },
  ]

  return (
    <PreviewBox label="Bottom Nav" description="Navegação principal — 4 a 5 tabs">
      <div style={{
        background: 'var(--color-surface-primary)',
        borderTop: '1px solid var(--color-border)',
        borderRadius: 16,
        boxShadow: '0px -0.33px 0px rgba(0,0,0,0.12)'
      }}>
        <div style={{ display: 'flex', padding: '0 16px 4px' }}>
          {tabs.map(({ to, Icon, label }) => {
            const isActive = active === to
            const isProfile = to === '/profile'
            return (
              <button key={to} onClick={() => setActive(to)} style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', padding: '12px 0 8px', gap: 6,
                background: 'none', border: 'none', cursor: 'pointer',
                color: isActive ? 'var(--color-fg-accent-light)' : 'var(--color-fg-secondary)',
                fontFamily: 'var(--font-primary)', fontSize: 12, fontWeight: 600,
                transition: 'color 0.15s'
              }}>
                {isProfile ? (
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%',
                    background: 'var(--color-avatar-bg)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    outline: isActive ? '2px solid var(--color-fg-accent-light)' : 'none',
                    outlineOffset: 1
                  }}>
                    <span style={{ fontFamily: 'var(--font-primary)', fontWeight: 500, fontSize: 9, color: 'var(--color-avatar-fg)', lineHeight: 1 }}>
                      LC
                    </span>
                  </div>
                ) : (
                  <Icon size={24} weight={isActive ? 'fill' : 'regular'} />
                )}
                <span>{label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </PreviewBox>
  )
}

// ─── Tabs Preview ─────────────────────────────────────────────────────────────

export function TabsPreview() {
  const [active, setActive] = useState('placar')
  const tabs = ['Placar', 'Jogador', 'Ranking']

  return (
    <PreviewBox label="Tabs (Segmented Control)" description="Controle de abas inline">
      <div style={{
        display: 'flex', gap: 16, padding: 8,
        background: 'var(--color-surface-secondary)',
        borderRadius: 20
      }}>
        {tabs.map(tab => {
          const key = tab.toLowerCase()
          const isActive = active === key
          return (
            <button key={key} onClick={() => setActive(key)} style={{
              flex: 1, padding: '8px 12px', borderRadius: 16, border: 'none',
              background: isActive ? 'white' : 'transparent',
              color: 'var(--color-fg-primary)',
              fontFamily: 'var(--font-primary)', fontWeight: 500, fontSize: 16,
              cursor: 'pointer', transition: 'background 0.15s',
              boxShadow: isActive ? '0 1px 4px rgba(0,0,0,0.08)' : 'none'
            }}>
              {tab}
            </button>
          )
        })}
      </div>
    </PreviewBox>
  )
}

// ─── Toggle Preview ───────────────────────────────────────────────────────────

export function TogglePreview() {
  const [v1, setV1] = useState(true)
  const [v2, setV2] = useState(false)

  function Toggle({ active, onChange, disabled = false }: { active: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
    return (
      <button onClick={() => !disabled && onChange(!active)} style={{
        width: 68, height: 36, borderRadius: 9999,
        background: active ? 'var(--color-surface-quaternary)' : 'var(--color-surface-secondary)',
        position: 'relative', border: 'none',
        cursor: disabled ? 'default' : 'pointer',
        transition: 'background 0.25s', flexShrink: 0, padding: 0,
        opacity: disabled ? 0.5 : 1
      }}>
        <div style={{
          position: 'absolute', top: '50%', transform: 'translateY(-50%)',
          left: active ? 35 : 3,
          width: 30, height: 30, borderRadius: '50%',
          background: 'white',
          boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
          transition: 'left 0.25s'
        }} />
      </button>
    )
  }

  return (
    <PreviewBox label="Toggle" description="Switch on/off — usado em configurações">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {[
          { label: 'Ativo (On)', active: v1, onChange: setV1, disabled: false },
          { label: 'Inativo (Off)', active: v2, onChange: setV2, disabled: false },
          { label: 'Disabled', active: true, onChange: () => {}, disabled: true },
        ].map(({ label, active, onChange, disabled }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'var(--font-primary)', fontSize: 16, fontWeight: 500, color: 'var(--color-fg-primary)' }}>
              {label}
            </span>
            <Toggle active={active} onChange={onChange} disabled={disabled} />
          </div>
        ))}
      </div>
    </PreviewBox>
  )
}

// ─── Cards Preview ────────────────────────────────────────────────────────────

export function CardsPreview() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      <PreviewBox label="Surface Card" description="Fundo --color-surface-primary · radius-card (24px)">
        <div style={{
          background: 'var(--color-surface-primary)',
          borderRadius: 24, padding: '20px 24px',
          display: 'flex', flexDirection: 'column', gap: 4
        }}>
          <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 600, fontSize: 16, color: 'var(--color-fg-primary)', margin: 0 }}>
            Título do card
          </p>
          <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 400, fontSize: 14, color: 'var(--color-fg-secondary)', margin: 0 }}>
            Subtítulo ou descrição do conteúdo
          </p>
        </div>
      </PreviewBox>

      <PreviewBox label="Info Card" description="Fundo --color-info-bg · accent foreground">
        <div style={{
          background: 'var(--color-info-bg)',
          borderRadius: 16, padding: '16px 20px',
          display: 'flex', alignItems: 'center', gap: 12
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12, flexShrink: 0,
            background: 'var(--color-surface-accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <SoccerBall size={20} weight="fill" color="white" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 600, fontSize: 14, color: 'var(--color-info-fg)', margin: 0 }}>
              Informação importante
            </p>
            <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 400, fontSize: 12, color: 'var(--color-info-fg)', opacity: 0.75, margin: 0 }}>
              Mensagem de apoio ao usuário
            </p>
          </div>
        </div>
      </PreviewBox>

      <PreviewBox label="Stat Card" description="Usado em stat grids — número em destaque">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            { label: 'Presenças', value: '12' },
            { label: 'Bola Cheia', value: '3' },
            { label: 'Bola Murcha', value: '1' },
            { label: 'Gols', value: '7' },
          ].map(({ label, value }) => (
            <div key={label} style={{
              background: 'var(--color-surface-primary)', borderRadius: 16, padding: 16,
              display: 'flex', flexDirection: 'column', gap: 4, height: 76
            }}>
              <span style={{ fontFamily: 'var(--font-primary)', fontWeight: 500, fontSize: 12, color: 'var(--color-fg-secondary)' }}>
                {label}
              </span>
              <span style={{ fontFamily: 'var(--font-primary)', fontWeight: 700, fontSize: 24, color: 'var(--color-fg-primary)', lineHeight: 1 }}>
                {value}
              </span>
            </div>
          ))}
        </div>
      </PreviewBox>

      <PreviewBox label="Score Card" description="Placar de jogo — usado na aba Placar">
        <div style={{
          background: 'var(--color-surface-primary)',
          borderRadius: 20, padding: '24px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <span style={{ fontFamily: 'var(--font-primary)', fontWeight: 700, fontSize: 32, color: 'var(--color-fg-primary)' }}>05</span>
            <img src="/team-blue.png" alt="Time Azul" style={{ width: 64, height: 64, objectFit: 'contain' }} />
          </div>
          <span style={{ fontFamily: 'var(--font-primary)', fontWeight: 700, fontSize: 32, color: 'var(--color-fg-primary)' }}>x</span>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <span style={{ fontFamily: 'var(--font-primary)', fontWeight: 700, fontSize: 32, color: 'var(--color-fg-primary)' }}>03</span>
            <img src="/team-yellow.png" alt="Time Amarelo" style={{ width: 64, height: 64, objectFit: 'contain' }} />
          </div>
        </div>
      </PreviewBox>

    </div>
  )
}

// ─── List Item Preview ────────────────────────────────────────────────────────

export function ListItemPreview() {
  const players = [
    { initials: 'LC', name: 'Lucas Cardoso',   sub: 'Confirmado', accent: true  },
    { initials: 'MF', name: 'Marcos Ferreira', sub: 'Confirmado', accent: true  },
    { initials: 'RB', name: 'Rafael Brito',    sub: 'Pendente',   accent: false },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PreviewBox label="List Item — Jogador" description="height 64 · radius 24 · gap 8 · --color-surface-primary">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {players.map(({ initials, name, sub, accent }) => (
            <div key={name} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: 16, height: 64, borderRadius: 24,
              background: 'var(--color-surface-primary)',
              border: '1.5px solid transparent'
            }}>
              {/* Avatar */}
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'var(--color-avatar-bg)', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <span style={{ fontFamily: 'var(--font-primary)', fontWeight: 600, fontSize: 11, color: 'var(--color-avatar-fg)' }}>
                  {initials}
                </span>
              </div>
              {/* Texto */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 500, fontSize: 16, color: 'var(--color-fg-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {name}
                </p>
              </div>
              {/* Badge status */}
              <span style={{
                fontFamily: 'var(--font-primary)', fontWeight: 500, fontSize: 12,
                color: accent ? 'var(--color-surface-accent)' : 'var(--color-fg-secondary)',
                flexShrink: 0
              }}>
                {sub}
              </span>
            </div>
          ))}
        </div>
      </PreviewBox>

      <PreviewBox label="List Item — Histórico" description="Linha de resultado de jogo">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { date: '18/06', blue: 5, yellow: 3 },
            { date: '11/06', blue: 2, yellow: 4 },
          ].map(({ date, blue, yellow }) => (
            <div key={date} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '16px', borderRadius: 24,
              background: 'var(--color-surface-primary)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                <img src="/team-blue.png" alt="Azul" style={{ width: 26, height: 26, objectFit: 'contain' }} />
                <span style={{ fontFamily: 'var(--font-primary)', fontWeight: 500, fontSize: 16, color: blue > yellow ? 'var(--color-fg-accent)' : 'var(--color-fg-secondary)' }}>
                  {blue}
                </span>
              </div>
              <span style={{ fontFamily: 'var(--font-primary)', fontSize: 11, color: 'var(--color-fg-secondary)' }}>
                {date}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'flex-end' }}>
                <span style={{ fontFamily: 'var(--font-primary)', fontWeight: 500, fontSize: 16, color: yellow > blue ? '#b8860b' : 'var(--color-fg-secondary)' }}>
                  {yellow}
                </span>
                <img src="/team-yellow.png" alt="Amarelo" style={{ width: 26, height: 26, objectFit: 'contain' }} />
              </div>
            </div>
          ))}
        </div>
      </PreviewBox>
    </div>
  )
}

// ─── Avatar Preview ───────────────────────────────────────────────────────────

export function AvatarPreview() {
  const sizes = [
    { size: 24, label: '24px — Nav'    },
    { size: 32, label: '32px — List'   },
    { size: 48, label: '48px — Sheet'  },
    { size: 64, label: '64px — Perfil' },
    { size: 96, label: '96px — Sheet Detail' },
  ]

  return (
    <PreviewBox label="Avatar" description="Iniciais ou foto · fundo --color-avatar-bg · fg --color-avatar-fg">
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20, flexWrap: 'wrap' }}>
        {sizes.map(({ size, label }) => (
          <div key={size} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: size, height: size, borderRadius: '50%',
              background: 'var(--color-avatar-bg)', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden'
            }}>
              <span style={{
                fontFamily: 'var(--font-primary)', fontWeight: 600,
                fontSize: size * 0.35, color: 'var(--color-avatar-fg)', lineHeight: 1
              }}>
                LC
              </span>
            </div>
            <span style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--color-fg-secondary)', whiteSpace: 'nowrap' }}>
              {label}
            </span>
          </div>
        ))}
      </div>
    </PreviewBox>
  )
}

// ─── Badge Ranking Preview ────────────────────────────────────────────────────

const MEDAL = {
  1: { bg: 'var(--color-surface-gold)',   fg: '#1a1a1a', label: '1º' },
  2: { bg: 'var(--color-surface-silver)', fg: '#1a1a1a', label: '2º' },
  3: { bg: 'var(--color-surface-bronze)', fg: '#ffffff', label: '3º' },
} as const

function BadgeRankingDemo({ rank, name, count }: { rank: 1 | 2 | 3; name: string; count: number }) {
  const medal = MEDAL[rank]
  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'center', width: 100, position: 'relative' }}>
      <div style={{ width: 100, height: 100, borderRadius: 24, background: 'var(--color-surface-secondary)', overflow: 'hidden', position: 'relative', flexShrink: 0 }}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontFamily: 'var(--font-primary)', fontWeight: 700, fontSize: 28, color: 'var(--color-badge-initials)', opacity: 0.5 }}>
            {initials}
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, width: '100%' }}>
        <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 500, fontSize: 13, color: 'var(--color-fg-primary)', textAlign: 'center', margin: 0 }}>
          {name}
        </p>
        <span style={{ fontFamily: 'var(--font-primary)', fontWeight: 400, fontSize: 11, color: 'var(--color-fg-secondary)' }}>
          {count}x
        </span>
      </div>
      <div style={{
        position: 'absolute', top: 76, left: '50%', transform: 'translateX(-50%)',
        width: 40, height: 40, borderRadius: '50%',
        border: '2px solid var(--color-bg)',
        background: medal.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1, flexShrink: 0
      }}>
        <span style={{ fontFamily: 'var(--font-primary)', fontWeight: 500, fontSize: 16, color: medal.fg }}>
          {medal.label}
        </span>
      </div>
    </div>
  )
}

export function BadgeRankingPreview() {
  return (
    <PreviewBox label="Badge Ranking" description="Pódio de presença ou votação · medalha sobreposta">
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', padding: '0 16px' }}>
        <BadgeRankingDemo rank={2} name="Marcos F." count={9} />
        <BadgeRankingDemo rank={1} name="Lucas C." count={12} />
        <BadgeRankingDemo rank={3} name="Rafael B." count={7} />
      </div>
    </PreviewBox>
  )
}

// ─── Bottom Sheet Preview ─────────────────────────────────────────────────────

export function BottomSheetPreview() {
  const [open, setOpen] = useState(false)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PreviewBox label="Bottom Sheet" description="Sobreposição a partir da base — radius 24 no topo">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button onClick={() => setOpen(!open)} style={{
            height: 48, paddingInline: 24, borderRadius: 99999,
            background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-fg)',
            fontFamily: 'var(--font-primary)', fontWeight: 500, fontSize: 16,
            border: 'none', cursor: 'pointer'
          }}>
            {open ? 'Fechar Sheet' : 'Abrir Sheet'}
          </button>

          {open && (
            <div style={{
              background: 'var(--color-bg)',
              borderRadius: '24px 24px 0 0',
              border: '1px solid var(--color-border)',
              padding: '24px 24px 32px',
              display: 'flex', flexDirection: 'column', gap: 20
            }}>
              {/* Handle bar */}
              <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--color-border)', margin: '0 auto' }} />

              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'var(--font-primary)', fontWeight: 600, fontSize: 16, color: 'var(--color-fg-primary)' }}>
                  Título da Sheet
                </span>
                <button onClick={() => setOpen(false)} style={{
                  width: 32, height: 32, borderRadius: 16,
                  background: 'var(--color-surface-primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: 'none', cursor: 'pointer', flexShrink: 0
                }}>
                  <X size={16} color="var(--color-fg-secondary)" />
                </button>
              </div>

              {/* Conteúdo placeholder */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {['Item A', 'Item B', 'Item C'].map(item => (
                  <div key={item} style={{
                    padding: 16, borderRadius: 24, height: 56,
                    background: 'var(--color-surface-primary)',
                    display: 'flex', alignItems: 'center'
                  }}>
                    <span style={{ fontFamily: 'var(--font-primary)', fontWeight: 500, fontSize: 16, color: 'var(--color-fg-primary)' }}>
                      {item}
                    </span>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <button style={{
                height: 56, borderRadius: 99999, border: 'none',
                background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-fg)',
                fontFamily: 'var(--font-primary)', fontWeight: 500, fontSize: 16, cursor: 'pointer'
              }}>
                Confirmar
              </button>
            </div>
          )}
        </div>
      </PreviewBox>
    </div>
  )
}

// Design System — tokens extraídos de index.css
// Acessível em /design-system (local only)

// ─── Types ───────────────────────────────────────────────────────────────────

interface Token {
  name: string
  value: string
  label?: string
}

// ─── Data ────────────────────────────────────────────────────────────────────

const COLORS_SURFACE: Token[] = [
  { name: '--color-bg',                    value: '#ffffff',  label: 'Background' },
  { name: '--color-surface-primary',       value: '#f8f8f8',  label: 'Surface Primary' },
  { name: '--color-surface-secondary',     value: '#efefef',  label: 'Surface Secondary' },
  { name: '--color-surface-accent',        value: '#082996',  label: 'Surface Accent' },
  { name: '--color-surface-accent-light',  value: '#e6f8ff',  label: 'Surface Accent Light' },
  { name: '--color-surface-accent-yellow', value: '#FFDC50',  label: 'Surface Accent Yellow' },
  { name: '--color-surface-white',         value: '#ffffff',  label: 'Surface White' },
  { name: '--color-surface-quaternary',    value: '#66d1ff',  label: 'Surface Quaternary' },
  { name: '--color-surface-gold',          value: '#fad026',  label: 'Surface Gold' },
  { name: '--color-surface-silver',        value: '#e9e3cc',  label: 'Surface Silver' },
  { name: '--color-surface-bronze',        value: '#bb9a15',  label: 'Surface Bronze' },
]

const COLORS_FOREGROUND: Token[] = [
  { name: '--color-fg-primary',        value: '#1a1a1a', label: 'Foreground Primary' },
  { name: '--color-fg-secondary',      value: '#8e8e93', label: 'Foreground Secondary' },
  { name: '--color-fg-tertiary',       value: '#ffffff', label: 'Foreground Tertiary' },
  { name: '--color-fg-accent',         value: '#082996', label: 'Foreground Accent' },
  { name: '--color-fg-accent-light',   value: '#082996', label: 'Foreground Accent Light' },
  { name: '--color-fg-accent-yellow',  value: '#FFDC50', label: 'Foreground Accent Yellow' },
]

const COLORS_SEMANTIC: Token[] = [
  { name: '--color-border',  value: '#efefef', label: 'Border' },
  { name: '--color-success', value: '#34c759', label: 'Success' },
  { name: '--color-warning', value: '#ff9500', label: 'Warning' },
  { name: '--color-danger',  value: '#ff3b30', label: 'Danger' },
]

const COLORS_BUTTON: Token[] = [
  { name: '--btn-primary-bg',      value: '#082996', label: 'Button Primary BG' },
  { name: '--btn-primary-fg',      value: '#ffffff', label: 'Button Primary FG' },
  { name: '--btn-secondary-bg',    value: '#e6f8ff', label: 'Button Secondary BG' },
  { name: '--btn-secondary-fg',    value: '#082996', label: 'Button Secondary FG' },
]

const COLORS_SPECIAL: Token[] = [
  { name: '--color-avatar-bg',     value: '#66d1ff', label: 'Avatar BG' },
  { name: '--color-avatar-fg',     value: '#082996', label: 'Avatar FG' },
  { name: '--color-info-bg',       value: '#e6f8ff', label: 'Info BG' },
  { name: '--color-info-fg',       value: '#082996', label: 'Info FG' },
  { name: '--color-number-bg',     value: '#efefef', label: 'Number BG' },
  { name: '--color-number-fg',     value: '#1a1a1a', label: 'Number FG' },
]

const FONT_SIZES: Token[] = [
  { name: '--font-size-11', value: '11px', label: 'Size 11' },
  { name: '--font-size-12', value: '12px', label: 'Size 12' },
  { name: '--font-size-14', value: '14px', label: 'Size 14' },
  { name: '--font-size-16', value: '16px', label: 'Size 16 — Body' },
  { name: '--font-size-18', value: '18px', label: 'Size 18' },
  { name: '--font-size-24', value: '24px', label: 'Size 24 — Title' },
  { name: '--font-size-32', value: '32px', label: 'Size 32 — Display' },
]

const SPACING: Token[] = [
  { name: '--space-8',  value: '8px',  label: 'Space 8' },
  { name: '--space-16', value: '16px', label: 'Space 16' },
  { name: '--space-24', value: '24px', label: 'Space 24' },
  { name: '--space-40', value: '40px', label: 'Space 40' },
]

const RADII: Token[] = [
  { name: '--radius-tag',  value: '16px',     label: 'Tag' },
  { name: '--radius-card', value: '24px',     label: 'Card' },
  { name: '--radius-pill', value: '99999px',  label: 'Pill' },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isLight(hex: string): boolean {
  const h = hex.replace('#', '')
  if (h.length < 6) return true
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 128
}

function CopyLabel({ text }: { text: string }) {
  const handleCopy = () => {
    navigator.clipboard.writeText(text).catch(() => {})
  }
  return (
    <button
      onClick={handleCopy}
      title="Copiar token"
      style={{
        background: 'none', border: 'none', padding: 0,
        cursor: 'pointer', textAlign: 'left', width: '100%'
      }}
    >
      <span style={{
        fontFamily: 'monospace', fontSize: 10,
        color: 'var(--color-fg-secondary)',
        display: 'block',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
      }}>
        {text}
      </span>
    </button>
  )
}

// ─── Section ─────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2 style={{
        fontFamily: 'var(--font-primary)', fontWeight: 600,
        fontSize: 18, color: 'var(--color-fg-primary)',
        margin: 0, paddingBottom: 12,
        borderBottom: '1px solid var(--color-border)'
      }}>
        {title}
      </h2>
      {children}
    </section>
  )
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{
        fontFamily: 'var(--font-primary)', fontWeight: 500,
        fontSize: 13, color: 'var(--color-fg-secondary)',
        margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em'
      }}>
        {title}
      </p>
      {children}
    </div>
  )
}

// ─── Color Swatch ─────────────────────────────────────────────────────────────

function ColorSwatch({ token }: { token: Token }) {
  const light = isLight(token.value)
  const checkered = token.value === '#ffffff'

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0
    }}>
      <div style={{
        height: 64, borderRadius: 12,
        background: checkered
          ? 'repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 0 0 / 12px 12px'
          : token.value,
        border: '1px solid var(--color-border)',
        display: 'flex', alignItems: 'flex-end',
        padding: '6px 8px', flexShrink: 0
      }}>
        <span style={{
          fontFamily: 'monospace', fontSize: 10,
          color: light ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.7)',
          fontWeight: 600
        }}>
          {token.value}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{
          fontFamily: 'var(--font-primary)', fontWeight: 500,
          fontSize: 12, color: 'var(--color-fg-primary)'
        }}>
          {token.label}
        </span>
        <CopyLabel text={token.name} />
      </div>
    </div>
  )
}

function ColorGrid({ tokens }: { tokens: Token[] }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
      gap: 16
    }}>
      {tokens.map(t => <ColorSwatch key={t.name} token={t} />)}
    </div>
  )
}

// ─── Typography Row ───────────────────────────────────────────────────────────

function TypographyRow({ token }: { token: Token }) {
  const size = parseInt(token.value)
  const weights: Array<[number, string]> = [
    [400, 'Regular'],
    [500, 'Medium'],
    [600, 'SemiBold'],
    [700, 'Bold'],
  ]

  return (
    <div style={{
      padding: '16px 20px', borderRadius: 16,
      background: 'var(--color-surface-primary)',
      display: 'flex', flexDirection: 'column', gap: 12
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <span style={{
          fontFamily: 'var(--font-primary)', fontWeight: 500,
          fontSize: 13, color: 'var(--color-fg-secondary)'
        }}>
          {token.label}
        </span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <CopyLabel text={token.name} />
          <span style={{
            fontFamily: 'monospace', fontSize: 11,
            color: 'var(--color-fg-secondary)',
            background: 'var(--color-surface-secondary)',
            padding: '2px 8px', borderRadius: 6
          }}>
            {token.value}
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {weights.map(([w, label]) => (
          <div key={w} style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <span style={{
              fontFamily: 'var(--font-primary)', fontSize: size,
              fontWeight: w, color: 'var(--color-fg-primary)',
              lineHeight: 1.3, flex: 1,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
            }}>
              Poppins {label}
            </span>
            <span style={{
              fontFamily: 'var(--font-primary)', fontSize: 11,
              color: 'var(--color-fg-secondary)', flexShrink: 0
            }}>
              {w}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Spacing Row ──────────────────────────────────────────────────────────────

function SpacingRow({ token }: { token: Token }) {
  const px = parseInt(token.value)
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 16,
      padding: '12px 20px', borderRadius: 16,
      background: 'var(--color-surface-primary)'
    }}>
      <div style={{
        width: px, height: px, borderRadius: 6, flexShrink: 0,
        background: 'var(--color-surface-accent)', opacity: 0.7
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontFamily: 'var(--font-primary)', fontWeight: 500,
          fontSize: 14, color: 'var(--color-fg-primary)', margin: 0
        }}>
          {token.label}
        </p>
        <CopyLabel text={token.name} />
      </div>
      <span style={{
        fontFamily: 'monospace', fontSize: 13,
        color: 'var(--color-fg-secondary)', flexShrink: 0
      }}>
        {token.value}
      </span>
    </div>
  )
}

// ─── Radius Row ───────────────────────────────────────────────────────────────

function RadiusRow({ token }: { token: Token }) {
  const radius = token.value === '99999px' ? 9999 : parseInt(token.value)
  const boxSize = 64

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 20,
      padding: '16px 20px', borderRadius: 16,
      background: 'var(--color-surface-primary)'
    }}>
      <div style={{
        width: boxSize, height: boxSize,
        borderRadius: radius,
        border: '1.5px solid var(--color-surface-accent)',
        background: 'var(--color-surface-accent-light)',
        flexShrink: 0
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontFamily: 'var(--font-primary)', fontWeight: 500,
          fontSize: 14, color: 'var(--color-fg-primary)', margin: 0
        }}>
          {token.label}
        </p>
        <CopyLabel text={token.name} />
      </div>
      <span style={{
        fontFamily: 'monospace', fontSize: 13,
        color: 'var(--color-fg-secondary)', flexShrink: 0
      }}>
        {token.value}
      </span>
    </div>
  )
}

// ─── Buttons Preview ──────────────────────────────────────────────────────────

function ButtonsPreview() {
  return (
    <div style={{
      display: 'flex', gap: 12, flexWrap: 'wrap',
      padding: '20px', borderRadius: 16,
      background: 'var(--color-surface-primary)'
    }}>
      <button style={{
        height: 48, paddingInline: 24, borderRadius: 99999,
        background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-fg)',
        fontFamily: 'var(--font-primary)', fontWeight: 500, fontSize: 16,
        border: 'none', cursor: 'pointer'
      }}>
        Primary
      </button>
      <button style={{
        height: 48, paddingInline: 24, borderRadius: 99999,
        background: 'var(--btn-secondary-bg)', color: 'var(--btn-secondary-fg)',
        fontFamily: 'var(--font-primary)', fontWeight: 500, fontSize: 16,
        border: '1.5px solid var(--btn-secondary-border)',
        cursor: 'pointer'
      }}>
        Secondary
      </button>
      <button style={{
        height: 48, paddingInline: 24, borderRadius: 99999,
        background: 'transparent', color: 'var(--color-danger)',
        fontFamily: 'var(--font-primary)', fontWeight: 500, fontSize: 16,
        border: '1.5px solid var(--color-danger)', cursor: 'pointer'
      }}>
        Danger
      </button>
      <button style={{
        height: 48, paddingInline: 24, borderRadius: 99999,
        background: 'var(--color-surface-secondary)', color: 'var(--color-fg-secondary)',
        fontFamily: 'var(--font-primary)', fontWeight: 500, fontSize: 16,
        border: 'none', cursor: 'default', opacity: 0.6
      }} disabled>
        Disabled
      </button>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DesignSystemPage() {
  return (
    <div style={{
      minHeight: '100dvh',
      background: 'var(--color-bg)',
      padding: '32px 24px 80px',
      display: 'flex', flexDirection: 'column', gap: 48,
      maxWidth: 800, margin: '0 auto'
    }}>

      {/* Header */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src="/team-blue.png" alt="ChicoFC" style={{ width: 36, height: 36, objectFit: 'contain' }} />
          <h1 style={{
            fontFamily: 'var(--font-primary)', fontWeight: 700,
            fontSize: 24, color: 'var(--color-fg-primary)', margin: 0
          }}>
            ChicoFC Design System
          </h1>
        </div>
        <p style={{
          fontFamily: 'var(--font-primary)', fontWeight: 400,
          fontSize: 14, color: 'var(--color-fg-secondary)', margin: 0
        }}>
          Tokens de design extraídos de <code style={{ fontFamily: 'monospace', fontSize: 12 }}>index.css</code> · Clique no token para copiar
        </p>
      </div>

      {/* Colors */}
      <Section title="Colors">
        <SubSection title="Surface">
          <ColorGrid tokens={COLORS_SURFACE} />
        </SubSection>
        <SubSection title="Foreground">
          <ColorGrid tokens={COLORS_FOREGROUND} />
        </SubSection>
        <SubSection title="Semantic">
          <ColorGrid tokens={COLORS_SEMANTIC} />
        </SubSection>
        <SubSection title="Buttons">
          <ColorGrid tokens={COLORS_BUTTON} />
        </SubSection>
        <SubSection title="Special">
          <ColorGrid tokens={COLORS_SPECIAL} />
        </SubSection>
      </Section>

      {/* Typography */}
      <Section title="Typography">
        <div style={{
          padding: '16px 20px', borderRadius: 16,
          background: 'var(--color-surface-primary)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <span style={{
            fontFamily: 'var(--font-primary)', fontWeight: 500,
            fontSize: 14, color: 'var(--color-fg-secondary)'
          }}>
            Font Family
          </span>
          <span style={{
            fontFamily: 'var(--font-primary)', fontWeight: 600,
            fontSize: 16, color: 'var(--color-fg-primary)'
          }}>
            Poppins
          </span>
        </div>
        <SubSection title="Sizes">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {FONT_SIZES.map(t => <TypographyRow key={t.name} token={t} />)}
          </div>
        </SubSection>
      </Section>

      {/* Spacing */}
      <Section title="Spacing">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {SPACING.map(t => <SpacingRow key={t.name} token={t} />)}
        </div>
      </Section>

      {/* Border Radius */}
      <Section title="Border Radius">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {RADII.map(t => <RadiusRow key={t.name} token={t} />)}
        </div>
      </Section>

      {/* Buttons */}
      <Section title="Buttons">
        <ButtonsPreview />
      </Section>

    </div>
  )
}

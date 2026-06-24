import type { Token } from './tokens'

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function isLight(hex: string): boolean {
  const h = hex.replace('#', '')
  if (h.length < 6) return true
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 128
}

// ─── CopyLabel ───────────────────────────────────────────────────────────────

export function CopyLabel({ text }: { text: string }) {
  return (
    <button
      onClick={() => navigator.clipboard.writeText(text).catch(() => {})}
      title="Copiar token"
      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', width: '100%' }}
    >
      <span style={{
        fontFamily: 'monospace', fontSize: 10,
        color: 'var(--color-fg-secondary)',
        display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
      }}>
        {text}
      </span>
    </button>
  )
}

// ─── Section / SubSection ─────────────────────────────────────────────────────

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2 style={{
        fontFamily: 'var(--font-primary)', fontWeight: 600, fontSize: 18,
        color: 'var(--color-fg-primary)', margin: 0, paddingBottom: 12,
        borderBottom: '1px solid var(--color-border)'
      }}>
        {title}
      </h2>
      {children}
    </section>
  )
}

export function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{
        fontFamily: 'var(--font-primary)', fontWeight: 500, fontSize: 13,
        color: 'var(--color-fg-secondary)', margin: 0,
        textTransform: 'uppercase', letterSpacing: '0.06em'
      }}>
        {title}
      </p>
      {children}
    </div>
  )
}

// ─── ColorSwatch / ColorGrid ──────────────────────────────────────────────────

export function ColorSwatch({ token }: { token: Token }) {
  const light = isLight(token.value)
  const checkered = token.value === '#ffffff'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
      <div style={{
        height: 64, borderRadius: 12, border: '1px solid var(--color-border)',
        background: checkered
          ? 'repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 0 0 / 12px 12px'
          : token.value,
        display: 'flex', alignItems: 'flex-end', padding: '6px 8px', flexShrink: 0
      }}>
        <span style={{
          fontFamily: 'monospace', fontSize: 10, fontWeight: 600,
          color: light ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.7)'
        }}>
          {token.value}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontFamily: 'var(--font-primary)', fontWeight: 500, fontSize: 12, color: 'var(--color-fg-primary)' }}>
          {token.label}
        </span>
        <CopyLabel text={token.name} />
      </div>
    </div>
  )
}

export function ColorGrid({ tokens }: { tokens: Token[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 16 }}>
      {tokens.map(t => <ColorSwatch key={t.name} token={t} />)}
    </div>
  )
}

// ─── TypographyRow ────────────────────────────────────────────────────────────

export function TypographyRow({ token }: { token: Token }) {
  const size = parseInt(token.value)
  const weights: Array<[number, string]> = [[400, 'Regular'], [500, 'Medium'], [600, 'SemiBold'], [700, 'Bold']]
  return (
    <div style={{ padding: '16px 20px', borderRadius: 16, background: 'var(--color-surface-primary)', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'var(--font-primary)', fontWeight: 500, fontSize: 13, color: 'var(--color-fg-secondary)' }}>
          {token.label}
        </span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <CopyLabel text={token.name} />
          <span style={{
            fontFamily: 'monospace', fontSize: 11, color: 'var(--color-fg-secondary)',
            background: 'var(--color-surface-secondary)', padding: '2px 8px', borderRadius: 6
          }}>
            {token.value}
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {weights.map(([w, label]) => (
          <div key={w} style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <span style={{
              fontFamily: 'var(--font-primary)', fontSize: size, fontWeight: w,
              color: 'var(--color-fg-primary)', lineHeight: 1.3, flex: 1,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
            }}>
              Poppins {label}
            </span>
            <span style={{ fontFamily: 'var(--font-primary)', fontSize: 11, color: 'var(--color-fg-secondary)', flexShrink: 0 }}>
              {w}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── SpacingRow ───────────────────────────────────────────────────────────────

export function SpacingRow({ token }: { token: Token }) {
  const px = parseInt(token.value)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 20px', borderRadius: 16, background: 'var(--color-surface-primary)' }}>
      <div style={{ width: px, height: px, borderRadius: 6, flexShrink: 0, background: 'var(--color-surface-accent)', opacity: 0.7 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 500, fontSize: 14, color: 'var(--color-fg-primary)', margin: 0 }}>
          {token.label}
        </p>
        <CopyLabel text={token.name} />
      </div>
      <span style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--color-fg-secondary)', flexShrink: 0 }}>
        {token.value}
      </span>
    </div>
  )
}

// ─── RadiusRow ────────────────────────────────────────────────────────────────

export function RadiusRow({ token }: { token: Token }) {
  const radius = token.value === '99999px' ? 9999 : parseInt(token.value)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '16px 20px', borderRadius: 16, background: 'var(--color-surface-primary)' }}>
      <div style={{
        width: 64, height: 64, borderRadius: radius, flexShrink: 0,
        border: '1.5px solid var(--color-surface-accent)',
        background: 'var(--color-surface-accent-light)'
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 500, fontSize: 14, color: 'var(--color-fg-primary)', margin: 0 }}>
          {token.label}
        </p>
        <CopyLabel text={token.name} />
      </div>
      <span style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--color-fg-secondary)', flexShrink: 0 }}>
        {token.value}
      </span>
    </div>
  )
}

// ─── ButtonsPreview ───────────────────────────────────────────────────────────

export function ButtonsPreview() {
  const base: React.CSSProperties = {
    height: 48, paddingInline: 24, borderRadius: 99999,
    fontFamily: 'var(--font-primary)', fontWeight: 500, fontSize: 16, cursor: 'pointer'
  }
  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', padding: '20px', borderRadius: 16, background: 'var(--color-surface-primary)' }}>
      <button style={{ ...base, background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-fg)', border: 'none' }}>Primary</button>
      <button style={{ ...base, background: 'var(--btn-secondary-bg)', color: 'var(--btn-secondary-fg)', border: '1.5px solid var(--btn-secondary-border)' }}>Secondary</button>
      <button style={{ ...base, background: 'transparent', color: 'var(--color-danger)', border: '1.5px solid var(--color-danger)' }}>Danger</button>
      <button style={{ ...base, background: 'var(--color-surface-secondary)', color: 'var(--color-fg-secondary)', border: 'none', cursor: 'default', opacity: 0.6 }} disabled>Disabled</button>
    </div>
  )
}

interface HeaderProps {
  title: string
  subtitle?: string
  subtitle2?: string
  rightContent?: React.ReactNode
  chinelinhoActive?: boolean
  onChinelinhoClick?: () => void
}

export default function Header({ title, subtitle, subtitle2, rightContent, chinelinhoActive, onChinelinhoClick }: HeaderProps) {
  return (
    <div
      className="fixed top-0 inset-x-0 z-40"
      style={{
        background: 'var(--color-bg)',
        borderBottom: '1px solid var(--color-border)'
      }}
    >
      <div style={{ padding: '16px 24px' }}>
        <div className="flex items-center justify-between" style={{ gap: 8 }}>
          <p style={{
            color: 'var(--color-fg-primary)',
            fontFamily: 'var(--font-primary)',
            fontSize: 'var(--font-size-24)',
            fontWeight: 600,
            lineHeight: '28px',
            flex: 1,
            minWidth: 0
          }}>
            {title}
          </p>
          <div className="flex items-center shrink-0" style={{ gap: 8 }}>
            {chinelinhoActive && (
              <button
                onClick={onChinelinhoClick}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  height: 24, padding: '1px 8px',
                  background: 'var(--color-surface-primary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 16,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}>
                <span style={{
                  fontFamily: 'var(--font-primary)',
                  fontSize: 11,
                  fontWeight: 400,
                  color: 'var(--color-fg-primary)',
                  lineHeight: 1
                }}>
                  Modo Chinelinho
                </span>
                <span style={{ fontSize: 14, lineHeight: 1 }}>🩴</span>
              </button>
            )}
            {rightContent}
          </div>
        </div>
        {(subtitle || subtitle2) && (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column' }}>
            {subtitle && (
              <p style={{
                color: 'var(--color-fg-secondary)',
                fontFamily: 'var(--font-primary)',
                fontSize: 'var(--font-size-16)',
                fontWeight: 500,
                lineHeight: 1
              }}>
                {subtitle}
              </p>
            )}
            {subtitle2 && (
              <p style={{
                color: 'var(--color-fg-secondary)',
                fontFamily: 'var(--font-primary)',
                fontSize: 'var(--font-size-16)',
                fontWeight: 500,
                lineHeight: 1
              }}>
                {subtitle2}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

interface HeaderProps {
  title: string
  subtitle?: string
  subtitle2?: string
  rightContent?: React.ReactNode
}

export default function Header({ title, subtitle, subtitle2, rightContent }: HeaderProps) {
  return (
    <div
      className="fixed top-0 inset-x-0 z-40"
      style={{
        background: 'var(--color-bg)',
        borderBottom: '1px solid var(--color-border)'
      }}
    >
      <div className="flex items-start justify-between px-6 py-4">
        <div className="flex flex-col">
          <p style={{
            color: 'var(--color-fg-primary)',
            fontFamily: 'var(--font-primary)',
            fontSize: 'var(--font-size-24)',
            fontWeight: 600,
            lineHeight: '28px'
          }}>
            {title}
          </p>
          {subtitle && (
            <p style={{
              color: 'var(--color-fg-secondary)',
              fontFamily: 'var(--font-primary)',
              fontSize: 'var(--font-size-16)',
              fontWeight: 500
            }}>
              {subtitle}
            </p>
          )}
          {subtitle2 && (
            <p style={{
              color: 'var(--color-fg-secondary)',
              fontFamily: 'var(--font-primary)',
              fontSize: 'var(--font-size-16)',
              fontWeight: 500
            }}>
              {subtitle2}
            </p>
          )}
        </div>
        {rightContent && (
          <div className="shrink-0 mt-1">
            {rightContent}
          </div>
        )}
      </div>
    </div>
  )
}

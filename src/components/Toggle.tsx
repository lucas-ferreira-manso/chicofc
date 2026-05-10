interface ToggleProps {
  active: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}

export default function Toggle({ active, onChange, disabled = false }: ToggleProps) {
  return (
    <button
      role="switch"
      aria-checked={active}
      onClick={() => !disabled && onChange(!active)}
      style={{
        width: 68, height: 36, borderRadius: 9999,
        background: active ? 'var(--color-surface-quaternary)' : 'var(--color-surface-secondary)',
        position: 'relative', border: 'none',
        cursor: disabled ? 'default' : 'pointer',
        transition: 'background 0.25s', flexShrink: 0, padding: 0, outline: 'none',
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

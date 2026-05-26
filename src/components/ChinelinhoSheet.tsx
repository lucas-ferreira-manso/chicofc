import { useState } from 'react'
import { X, Check } from '@phosphor-icons/react'

interface Props {
  onClose: () => void
  onActivate: (until: string | null) => Promise<void>
}

type DurationKey = '2w' | '3w' | '1m' | 'indefinite'

const OPTIONS: { key: DurationKey; label: string; days: number | null }[] = [
  { key: '2w', label: '2 Semanas', days: 14 },
  { key: '3w', label: '3 Semanas', days: 21 },
  { key: '1m', label: '1 Mês', days: 30 },
  { key: 'indefinite', label: 'Mais que 1 mês', days: null },
]

export default function ChinelinhoSheet({ onClose, onActivate }: Props) {
  const [selected, setSelected] = useState<DurationKey | null>(null)
  const [loading, setLoading] = useState(false)

  const handleActivate = async () => {
    if (!selected) return
    setLoading(true)
    const opt = OPTIONS.find(o => o.key === selected)!
    const until = opt.days
      ? new Date(Date.now() + opt.days * 24 * 60 * 60 * 1000).toISOString()
      : null
    try {
      await onActivate(until)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 80 }}
      />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 90,
        background: 'var(--color-bg)', borderRadius: '24px 24px 0 0',
        padding: '24px 24px 40px',
        display: 'flex', flexDirection: 'column', gap: 20
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{
            fontFamily: 'var(--font-primary)', fontWeight: 600,
            fontSize: 'var(--font-size-20)', color: 'var(--color-fg-primary)'
          }}>
            Ativar Modo Chinelinho
          </p>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}>
            <X size={20} color="var(--color-fg-secondary)" />
          </button>
        </div>

        {/* Subtitle */}
        <p style={{
          fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-14)',
          color: 'var(--color-fg-secondary)', lineHeight: 1.55
        }}>
          Já que ser chinelinho, pelo menos mostre quanto tempo vai ficar nessa frescura!
        </p>

        {/* Options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {OPTIONS.map(opt => {
            const isSelected = selected === opt.key
            return (
              <button
                key={opt.key}
                onClick={() => setSelected(opt.key)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '16px 20px', borderRadius: 16,
                  background: 'var(--color-surface-primary)',
                  border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left'
                }}>
                <p style={{
                  fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)',
                  color: 'var(--color-fg-primary)', fontWeight: 400, margin: 0
                }}>
                  {opt.label}
                </p>
                {/* Radio circle */}
                <div style={{
                  width: 24, height: 24, borderRadius: '50%',
                  border: `2px solid var(--color-fg-accent)`,
                  background: isSelected ? 'var(--color-fg-accent)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, transition: 'background 0.15s'
                }}>
                  {isSelected && <Check size={13} weight="bold" color="white" />}
                </div>
              </button>
            )
          })}
        </div>

        {/* Ativar button */}
        <button
          onClick={handleActivate}
          disabled={!selected || loading}
          style={{
            width: '100%', padding: '16px', borderRadius: 9999,
            background: selected && !loading ? 'var(--btn-primary-bg)' : 'var(--color-surface-secondary)',
            color: selected && !loading ? 'var(--btn-primary-fg)' : 'var(--color-fg-secondary)',
            fontFamily: 'var(--font-primary)', fontWeight: 600,
            fontSize: 'var(--font-size-16)', border: 'none',
            cursor: selected && !loading ? 'pointer' : 'default',
            transition: 'background 0.2s, color 0.2s'
          }}>
          {loading ? 'Ativando...' : 'Ativar'}
        </button>
      </div>
    </>
  )
}

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { CaretLeft } from '@phosphor-icons/react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Payment } from '../types'

async function fetchPaymentsForExport(): Promise<Payment[]> {
  const [paymentsSnap, playersSnap] = await Promise.all([
    getDocs(collection(db, 'payments')),
    getDocs(collection(db, 'players'))
  ])
  const players = Object.fromEntries(playersSnap.docs.map(d => [d.id, d.data()]))
  return paymentsSnap.docs.map(d => {
    const data = d.data()
    const player = players[data.user_id] ?? {}
    return { id: d.id, ...data, profile: { id: data.user_id, name: player.name, email: player.email } } as Payment
  }).sort((a, b) => b.month.localeCompare(a.month))
}

export default function ExportarRelatorioPage() {
  const navigate = useNavigate()
  const [selected, setSelected] = useState<string>('tudo')

  const { data: payments = [] } = useQuery({
    queryKey: ['payments-export'],
    queryFn: fetchPaymentsForExport,
    staleTime: 5 * 60_000
  })

  // Normaliza month para yyyy-MM (pagamentos de jogo usam yyyy-MM-dd)
  const normalizeMonth = (month: string) => month.substring(0, 7)

  // Agrupa meses disponíveis por ano (sem duplicatas)
  const monthsByYear = payments
    .map(p => normalizeMonth(p.month))
    .filter((v, i, a) => a.indexOf(v) === i)
    .sort((a, b) => b.localeCompare(a))
    .reduce((acc, month) => {
      const year = month.split('-')[0]
      if (!acc[year]) acc[year] = []
      acc[year].push(month)
      return acc
    }, {} as Record<string, string[]>)

  const years = Object.keys(monthsByYear).sort((a, b) => Number(b) - Number(a))

  function getMonthLabel(monthKey: string) {
    const [year, m] = monthKey.split('-')
    return format(new Date(Number(year), Number(m) - 1, 1), 'MMMM', { locale: ptBR })
  }

  function capitalize(s: string) {
    return s.charAt(0).toUpperCase() + s.slice(1)
  }

  function handleExport() {
    const filtered = selected === 'tudo'
      ? payments
      : payments.filter(p => normalizeMonth(p.month) === selected)

    const lines = [
      'Nome,Tipo,Mês,Valor,Status,Data Pagamento',
      ...filtered.map(p => {
        const name = (p.profile as any)?.name || (p.profile as any)?.email || 'Jogador'
        const tipo = p.type === 'mensalidade' ? 'Mensalidade' : p.type === 'jogo' ? 'Avulso' : 'Despesa'
        const status = p.paid ? 'Pago' : 'Pendente'
        const dataPago = p.paid && p.paid_at ? format(new Date(p.paid_at), 'dd/MM/yyyy') : ''
        return `${name},${tipo},${p.month},${p.amount},${status},${dataPago}`
      })
    ]

    const csv = lines.join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const label = selected === 'tudo' ? 'completo' : selected
    a.href = url
    a.download = `caixinha-chicofc-${label}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col min-h-screen" style={{ background: 'var(--color-bg)', paddingBottom: 'calc(120px + env(safe-area-inset-bottom))' }}>
      {/* Header */}
      <div className="fixed top-0 inset-x-0 z-40" style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
        <div className="flex items-center gap-3 px-6 py-4">
          <button
            onClick={() => navigate(-1)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}>
            <CaretLeft size={24} color="var(--color-fg-primary)" />
          </button>
          <p style={{
            fontFamily: 'var(--font-primary)', fontWeight: 600,
            fontSize: 'var(--font-size-24)', lineHeight: '28px',
            color: 'var(--color-fg-primary)'
          }}>
            Exportar Relatório
          </p>
        </div>
      </div>
      <div style={{ height: 80 }} />

      <div className="px-6 flex flex-col gap-2 pt-4">
        <p style={{
          fontFamily: 'var(--font-primary)', fontWeight: 500,
          fontSize: 'var(--font-size-14)', color: 'var(--color-fg-secondary)',
          marginBottom: 8
        }}>
          Selecione o período
        </p>

        {/* Opção Tudo */}
        <RadioOption
          label="Tudo"
          value="tudo"
          selected={selected}
          onSelect={setSelected}
        />

        {/* Opções por ano */}
        {years.map(year => (
          <div key={year}>
            <p style={{
              fontFamily: 'var(--font-primary)', fontWeight: 600,
              fontSize: 'var(--font-size-12)', color: 'var(--color-fg-secondary)',
              textTransform: 'uppercase', letterSpacing: '0.05em',
              paddingTop: 16, paddingBottom: 8
            }}>
              {year}
            </p>
            <div className="flex flex-col gap-2">
              {monthsByYear[year].map(monthKey => (
                <RadioOption
                  key={monthKey}
                  label={capitalize(getMonthLabel(monthKey))}
                  value={monthKey}
                  selected={selected}
                  onSelect={setSelected}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Botão fixo no fundo */}
      <div className="fixed bottom-0 inset-x-0 px-6 pb-8 pt-4" style={{ background: 'var(--color-bg)' }}>
        <button
          onClick={handleExport}
          className="w-full py-4 font-medium rounded-full transition-all active:scale-95"
          style={{
            background: 'var(--btn-primary-bg)',
            color: 'var(--btn-primary-fg)',
            fontFamily: 'var(--font-primary)',
            fontSize: 'var(--font-size-16)'
          }}>
          Exportar Extrato
        </button>
      </div>
    </div>
  )
}

function RadioOption({
  label, value, selected, onSelect
}: {
  label: string
  value: string
  selected: string
  onSelect: (v: string) => void
}) {
  const isSelected = selected === value
  return (
    <button
      onClick={() => onSelect(value)}
      className="w-full flex items-center gap-3 px-4 py-4 rounded-3xl transition-all active:scale-[0.99]"
      style={{ background: 'var(--color-surface-primary)', border: 'none', cursor: 'pointer' }}>
      {/* Radio circle */}
      <div style={{
        width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
        border: `2px solid ${isSelected ? 'var(--btn-primary-bg)' : 'var(--color-border)'}`,
        background: isSelected ? 'var(--btn-primary-bg)' : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.15s'
      }}>
        {isSelected && (
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }} />
        )}
      </div>
      <p style={{
        fontFamily: 'var(--font-primary)', fontWeight: 500,
        fontSize: 'var(--font-size-16)', color: 'var(--color-fg-primary)'
      }}>
        {label}
      </p>
    </button>
  )
}

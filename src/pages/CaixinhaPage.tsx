import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { collection, getDocs, doc, updateDoc, addDoc, query, where } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuthStore } from '../store/authStore'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CheckCircle2, Circle, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import type { Payment, Profile } from '../types'

async function fetchPlayers(): Promise<Profile[]> {
  const snap = await getDocs(collection(db, 'players'))
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Profile)).filter(p => p.active)
}

async function fetchPayments(): Promise<Payment[]> {
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

export default function CaixinhaPage() {
  const qc = useQueryClient()
  const user = useAuthStore(s => s.user)
  const isAdmin = user?.role === 'admin'

  const { data: payments = [], isLoading } = useQuery({ queryKey: ['payments'], queryFn: fetchPayments })
  const { data: players = [] } = useQuery({ queryKey: ['players'], queryFn: fetchPlayers })

  const [showForm, setShowForm] = useState(false)
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'))
  const mensalistas = players.filter(p => p.player_type === 'mensalista')

  const togglePaid = useMutation({
    mutationFn: async ({ id, paid }: { id: string; paid: boolean }) => {
      await updateDoc(doc(db, 'payments', id), { paid: !paid, paid_at: !paid ? new Date().toISOString() : null })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payments'] }); toast.success('Atualizado!') }
  })

  const generateMonth = useMutation({
    mutationFn: async () => {
      const q = query(collection(db, 'payments'), where('month', '==', month), where('type', '==', 'mensalidade'))
      const existing = await getDocs(q)
      const existingIds = new Set(existing.docs.map(d => d.data().user_id))
      const newOnes = mensalistas.filter(p => !existingIds.has(p.id))
      await Promise.all(newOnes.map(p => addDoc(collection(db, 'payments'), {
        user_id: p.id, amount: 88, type: 'mensalidade', month, paid: false, created_at: new Date().toISOString()
      })))
      return newOnes.length
    },
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: ['payments'] })
      toast.success(count > 0 ? `${count} mensalidades criadas!` : 'Todos já têm mensalidade nesse mês')
      setShowForm(false)
    }
  })

  const jogoPayments = payments.filter(p => p.type === 'jogo')
  const byMonth = payments.filter(p => p.type === 'mensalidade').reduce((acc, p) => {
    if (!acc[p.month]) acc[p.month] = []
    acc[p.month].push(p)
    return acc
  }, {} as Record<string, Payment[]>)

  const totalReceived = payments.filter(p => p.paid).reduce((s, p) => s + p.amount, 0)
  const totalPending = payments.filter(p => !p.paid).reduce((s, p) => s + p.amount, 0)

  const inputStyle: React.CSSProperties = {
    background: 'var(--color-surface-primary)',
    borderRadius: 'var(--radius-pill)',
    border: 'none',
    outline: 'none',
    padding: '12px 20px',
    fontFamily: 'var(--font-primary)',
    fontSize: 'var(--font-size-16)',
    color: 'var(--color-fg-primary)',
    width: '100%'
  }

  return (
    <div className="flex flex-col min-h-full pb-28" style={{ background: 'var(--color-bg)' }}>
      {/* Header */}
      <div className="px-6 pt-12 pb-4 flex items-end justify-between">
        <div>
          <p className="font-bold" style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-32)' }}>
            Caixinha
          </p>
          <p style={{ color: 'var(--color-fg-secondary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)' }}>
            {players.length} jogadores
          </p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 rounded-full font-medium transition-all active:scale-95"
            style={{ background: showForm ? 'var(--color-surface-primary)' : 'var(--color-surface-accent)', color: showForm ? 'var(--color-danger)' : 'white', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-14)' }}>
            {showForm ? <><X size={15} /> Fechar</> : <><Plus size={15} /> Gerar mês</>}
          </button>
        )}
      </div>

      {/* Saldo */}
      <div className="mx-6 mb-4 p-5 rounded-3xl" style={{ background: 'var(--color-surface-primary)' }}>
        <p style={{ color: 'var(--color-fg-secondary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-14)' }}>Saldo total</p>
        <p className="font-bold mt-1" style={{ color: 'var(--color-fg-accent)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-32)' }}>
          R$ {totalReceived}
        </p>
        <div className="flex gap-6 mt-3">
          <div>
            <p style={{ color: 'var(--color-fg-secondary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-12)' }}>Recebido</p>
            <p className="font-semibold" style={{ color: 'var(--color-success)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)' }}>R$ {totalReceived}</p>
          </div>
          <div>
            <p style={{ color: 'var(--color-fg-secondary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-12)' }}>Pendente</p>
            <p className="font-semibold" style={{ color: 'var(--color-danger)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)' }}>R$ {totalPending}</p>
          </div>
        </div>
      </div>

      {/* Form gerar mês */}
      {showForm && isAdmin && (
        <div className="mx-6 mb-4 p-5 rounded-3xl flex flex-col gap-3" style={{ background: 'var(--color-surface-primary)' }}>
          <p className="font-semibold" style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)' }}>
            Gerar mensalidades (R$88)
          </p>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={inputStyle} />
          <button onClick={() => generateMonth.mutate()} disabled={generateMonth.isPending}
            className="w-full py-3.5 font-medium transition-all active:scale-95 disabled:opacity-40"
            style={{ background: 'var(--color-surface-accent)', color: 'white', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)' }}>
            {generateMonth.isPending ? 'Gerando...' : `Gerar para ${mensalistas.length} mensalistas`}
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8"><div className="text-4xl animate-spin">⚽</div></div>
      ) : (
        <div className="px-6 flex flex-col gap-6">
          {jogoPayments.length > 0 && (
            <section>
              <p className="font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-fg-secondary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-12)' }}>
                Por jogo — avulsos (R$22)
              </p>
              <div className="flex flex-col gap-2">
                {jogoPayments.map(p => <PaymentRow key={p.id} payment={p} onToggle={() => togglePaid.mutate({ id: p.id, paid: p.paid })} isAdmin={isAdmin} />)}
              </div>
            </section>
          )}

          {Object.entries(byMonth).map(([monthKey, monthPayments]) => {
            const [year, m] = monthKey.split('-')
            const label = format(new Date(Number(year), Number(m) - 1, 1), 'MMMM yyyy', { locale: ptBR })
            return (
              <section key={monthKey}>
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold uppercase tracking-wider capitalize" style={{ color: 'var(--color-fg-secondary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-12)' }}>
                    {label}
                  </p>
                  <p style={{ color: 'var(--color-fg-secondary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-12)' }}>
                    {monthPayments.filter(p => p.paid).length}/{monthPayments.length}
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  {monthPayments.map(p => <PaymentRow key={p.id} payment={p} onToggle={() => togglePaid.mutate({ id: p.id, paid: p.paid })} isAdmin={isAdmin} />)}
                </div>
              </section>
            )
          })}

          {payments.length === 0 && (
            <div className="text-center py-16">
              <div className="text-5xl mb-4">💰</div>
              <p className="font-medium" style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)' }}>Nenhum pagamento ainda</p>
              <p className="mt-1" style={{ color: 'var(--color-fg-secondary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-14)' }}>
                {isAdmin ? 'Clica em "Gerar mês" para começar' : 'Aguarde o admin'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function PaymentRow({ payment, onToggle, isAdmin }: { payment: Payment; onToggle: () => void; isAdmin?: boolean }) {
  const name = (payment.profile as any)?.name || (payment.profile as any)?.email || 'Jogador'
  return (
    <button onClick={isAdmin ? onToggle : undefined}
      className="w-full flex items-center gap-3 p-4 rounded-3xl transition-all active:scale-[0.99]"
      style={{ background: 'var(--color-surface-primary)', cursor: isAdmin ? 'pointer' : 'default' }}>
      {payment.paid
        ? <CheckCircle2 size={22} color="var(--color-success)" />
        : <Circle size={22} color="var(--color-fg-secondary)" />}
      <div className="flex-1 text-left">
        <p className="font-medium" style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)' }}>{name}</p>
        <p style={{ color: 'var(--color-fg-secondary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-12)' }}>
          {payment.paid ? `Pago em ${format(new Date(payment.paid_at!), 'd/MM/yyyy')}` : 'Pendente'}
        </p>
      </div>
      <p className="font-semibold" style={{ color: payment.paid ? 'var(--color-success)' : 'var(--color-danger)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)' }}>
        R$ {payment.amount}
      </p>
    </button>
  )
}

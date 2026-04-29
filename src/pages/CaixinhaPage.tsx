import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { collection, getDocs, doc, updateDoc, addDoc, query, where } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuthStore } from '../store/authStore'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CheckCircle2, Circle, Wallet, Plus, X } from 'lucide-react'
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
    return {
      id: d.id,
      ...data,
      profile: { id: data.user_id, name: player.name, email: player.email }
    } as Payment
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
      await updateDoc(doc(db, 'payments', id), {
        paid: !paid,
        paid_at: !paid ? new Date().toISOString() : null
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments'] })
      toast.success('Atualizado!')
    }
  })

  const generateMonth = useMutation({
    mutationFn: async () => {
      const q = query(collection(db, 'payments'), where('month', '==', month), where('type', '==', 'mensalidade'))
      const existing = await getDocs(q)
      const existingUserIds = new Set(existing.docs.map(d => d.data().user_id))
      const newOnes = mensalistas.filter(p => !existingUserIds.has(p.id))
      await Promise.all(newOnes.map(p =>
        addDoc(collection(db, 'payments'), {
          user_id: p.id,
          amount: 88,
          type: 'mensalidade',
          month,
          paid: false,
          created_at: new Date().toISOString()
        })
      ))
      return newOnes.length
    },
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: ['payments'] })
      toast.success(count > 0 ? `${count} mensalidades criadas!` : 'Todos já têm mensalidade nesse mês')
      setShowForm(false)
    },
    onError: () => toast.error('Erro ao gerar mensalidades')
  })

  // Separar pagamentos por tipo
  const mensalidadePayments = payments.filter(p => p.type === 'mensalidade')
  const jogoPayments = payments.filter(p => p.type === 'jogo')

  const totalReceived = payments.filter(p => p.paid).reduce((s, p) => s + p.amount, 0)
  const totalPending = payments.filter(p => !p.paid).reduce((s, p) => s + p.amount, 0)

  // Agrupar mensalidades por mês
  const byMonth = mensalidadePayments.reduce((acc, p) => {
    if (!acc[p.month]) acc[p.month] = []
    acc[p.month].push(p)
    return acc
  }, {} as Record<string, Payment[]>)

  const inputStyle = { background: 'var(--surface2)', border: '1px solid var(--border)' }

  return (
    <div className="flex flex-col min-h-full pb-24">
      <div className="px-4 pt-6 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Caixinha</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{players.length} jogadores</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-white text-sm"
            style={{ background: showForm ? '#7f1d1d' : 'var(--green)' }}
          >
            {showForm ? <><X size={16} /> Fechar</> : <><Plus size={16} /> Gerar mês</>}
          </button>
        )}
      </div>

      {showForm && isAdmin && (
        <div className="mx-4 mb-4 p-4 rounded-2xl space-y-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h2 className="text-sm font-semibold text-white">Gerar mensalidades (R$88)</h2>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Cria cobrança de R$88 para cada mensalista
          </p>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Mês</label>
            <input
              type="month"
              className="w-full px-3 py-2.5 rounded-xl text-white outline-none text-sm"
              style={inputStyle}
              value={month}
              onChange={e => setMonth(e.target.value)}
            />
          </div>
          <div className="rounded-xl p-3" style={{ background: 'var(--surface2)' }}>
            <p className="text-xs font-medium text-white mb-2">Mensalistas ({mensalistas.length})</p>
            <div className="space-y-1">
              {mensalistas.map(p => (
                <p key={p.id} className="text-xs" style={{ color: 'var(--text-muted)' }}>{p.name || p.email}</p>
              ))}
            </div>
          </div>
          <button
            onClick={() => generateMonth.mutate()}
            disabled={generateMonth.isPending}
            className="w-full py-3 rounded-xl font-semibold text-white transition-all active:scale-95 disabled:opacity-40"
            style={{ background: 'var(--green)' }}
          >
            {generateMonth.isPending ? 'Gerando...' : `Gerar para ${mensalistas.length} mensalistas`}
          </button>
        </div>
      )}

      {/* Saldo geral */}
      <div className="mx-4 mb-6 p-5 rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2 mb-3">
          <Wallet size={16} style={{ color: 'var(--green)' }} />
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Saldo total</span>
        </div>
        <div className="text-4xl font-bold text-white">R$ {totalReceived.toFixed(0)}</div>
        <div className="flex gap-6 mt-3 text-sm">
          <div>
            <div style={{ color: 'var(--text-muted)' }}>Recebido</div>
            <div className="font-semibold" style={{ color: 'var(--green)' }}>R$ {totalReceived}</div>
          </div>
          <div>
            <div style={{ color: 'var(--text-muted)' }}>Pendente</div>
            <div className="font-semibold" style={{ color: '#f87171' }}>R$ {totalPending}</div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center"><div className="text-4xl animate-spin">⚽</div></div>
      ) : (
        <div className="px-4 space-y-8">
          {/* Pagamentos por jogo (avulsos) */}
          {jogoPayments.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
                Por jogo — avulsos (R$22)
              </h2>
              <div className="space-y-2">
                {jogoPayments.map(payment => (
                  <PaymentRow key={payment.id} payment={payment} onToggle={() => togglePaid.mutate({ id: payment.id, paid: payment.paid })} isAdmin={isAdmin} />
                ))}
              </div>
            </section>
          )}

          {/* Mensalidades por mês */}
          {Object.entries(byMonth).map(([monthKey, monthPayments]) => {
            const [year, m] = monthKey.split('-')
            const monthLabel = format(new Date(Number(year), Number(m) - 1, 1), 'MMMM yyyy', { locale: ptBR })
            return (
              <section key={monthKey}>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xs font-semibold uppercase tracking-wider capitalize" style={{ color: 'var(--text-muted)' }}>
                    {monthLabel} — mensalidade (R$88)
                  </h2>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {monthPayments.filter(p => p.paid).length}/{monthPayments.length} pagaram
                  </span>
                </div>
                <div className="space-y-2">
                  {monthPayments.map(payment => (
                    <PaymentRow key={payment.id} payment={payment} onToggle={() => togglePaid.mutate({ id: payment.id, paid: payment.paid })} isAdmin={isAdmin} />
                  ))}
                </div>
              </section>
            )
          })}

          {payments.length === 0 && (
            <div className="text-center py-16">
              <div className="text-5xl mb-4">💰</div>
              <p className="text-white font-medium">Nenhum pagamento ainda</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                {isAdmin ? 'Clica em "Gerar mês" para começar' : 'Aguarde o admin gerar os pagamentos'}
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
    <button
      onClick={isAdmin ? onToggle : undefined}
      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)', cursor: isAdmin ? 'pointer' : 'default' }}
    >
      {payment.paid
        ? <CheckCircle2 size={20} style={{ color: 'var(--green)' }} />
        : <Circle size={20} style={{ color: 'var(--text-muted)' }} />}
      <div className="flex-1 text-left">
        <p className="text-sm font-medium text-white">{name}</p>
        {payment.paid_at && (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Pago em {format(new Date(payment.paid_at), 'd/MM/yyyy')}
          </p>
        )}
        {!payment.paid && (
          <p className="text-xs" style={{ color: '#f87171' }}>Pendente</p>
        )}
      </div>
      <span className="text-sm font-semibold" style={{ color: payment.paid ? 'var(--green)' : '#f87171' }}>
        R$ {payment.amount}
      </span>
    </button>
  )
}

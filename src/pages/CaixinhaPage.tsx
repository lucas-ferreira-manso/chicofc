import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { collection, getDocs, doc, updateDoc, addDoc, getDoc, setDoc, query, where } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuthStore } from '../store/authStore'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CheckCircle2, Circle } from 'lucide-react'
import { Copy, Check, PencilSimple, X } from '@phosphor-icons/react'
import { toast } from 'sonner'
import type { Payment, Profile } from '../types'

const PIX_CODE = '42c4fc79-a983-4a02-88fb-81ec76948c0f'

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

async function fetchConfig(): Promise<{ quadraCost: number }> {
  const snap = await getDoc(doc(db, 'config', 'caixinha'))
  if (!snap.exists()) return { quadraCost: 0 }
  return snap.data() as { quadraCost: number }
}

export default function CaixinhaPage() {
  const qc = useQueryClient()
  const user = useAuthStore(s => s.user)
  const isAdmin = user?.role === 'admin'

  const { data: payments = [] } = useQuery({ queryKey: ['payments'], queryFn: fetchPayments })
  const { data: players = [] } = useQuery({ queryKey: ['players'], queryFn: fetchPlayers })
  const { data: config } = useQuery({ queryKey: ['caixinha-config'], queryFn: fetchConfig })

  const [pixCopied, setPixCopied] = useState(false)
  const [editingQuadra, setEditingQuadra] = useState(false)
  const [quadraValue, setQuadraValue] = useState('')

  const handleCopyPix = () => {
    navigator.clipboard.writeText(PIX_CODE)
    setPixCopied(true)
    toast.success('PIX copiado!')
    setTimeout(() => setPixCopied(false), 3000)
  }

  const saveQuadra = useMutation({
    mutationFn: async () => {
      await setDoc(doc(db, 'config', 'caixinha'), { quadraCost: parseFloat(quadraValue) || 0 }, { merge: true })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['caixinha-config'] })
      toast.success('Valor da quadra atualizado!')
      setEditingQuadra(false)
    }
  })

  const togglePaid = useMutation({
    mutationFn: async ({ id, paid }: { id: string; paid: boolean }) => {
      await updateDoc(doc(db, 'payments', id), { paid: !paid, paid_at: !paid ? new Date().toISOString() : null })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payments'] }); toast.success('Atualizado!') }
  })

  const generateMonth = useMutation({
    mutationFn: async () => {
      const month = format(new Date(), 'yyyy-MM')
      const q = query(collection(db, 'payments'), where('month', '==', month), where('type', '==', 'mensalidade'))
      const existing = await getDocs(q)
      const existingIds = new Set(existing.docs.map(d => d.data().user_id))
      const mensalistas = players.filter(p => p.player_type === 'mensalista' && !existingIds.has(p.id))
      await Promise.all(mensalistas.map(p => addDoc(collection(db, 'payments'), {
        user_id: p.id, amount: 88, type: 'mensalidade', month, paid: false, created_at: new Date().toISOString()
      })))
      return mensalistas.length
    },
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: ['payments'] })
      toast.success(count > 0 ? `${count} mensalidades criadas!` : 'Todos já têm mensalidade')
    }
  })

  // Cálculos financeiros
  const jogoPayments = payments.filter(p => p.type === 'jogo')
  const avulsoPaid = jogoPayments.filter(p => p.paid).reduce((s, p) => s + p.amount, 0)
  const avulsoPending = jogoPayments.filter(p => !p.paid).reduce((s, p) => s + p.amount, 0)
  const quadraCost = config?.quadraCost ?? 0
  const saldoTotal = avulsoPaid - quadraCost

  const byMonth = payments.filter(p => p.type === 'mensalidade').reduce((acc, p) => {
    if (!acc[p.month]) acc[p.month] = []
    acc[p.month].push(p)
    return acc
  }, {} as Record<string, Payment[]>)

  return (
    <div className="flex flex-col min-h-full pb-28" style={{ background: 'var(--color-bg)' }}>

      {/* Header */}
      <div className="px-6 pt-12 pb-4 flex items-end justify-between">
        <div>
          <p className="font-semibold" style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-24)', lineHeight: '28px' }}>
            Caixinha
          </p>
          <p style={{ color: 'var(--color-fg-secondary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)' }}>
            {players.length} jogadores
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => generateMonth.mutate()}
            disabled={generateMonth.isPending}
            className="px-4 py-2 rounded-full font-medium transition-all active:scale-95 disabled:opacity-40"
            style={{ background: 'var(--color-surface-accent)', color: 'white', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-14)' }}>
            {generateMonth.isPending ? '...' : 'Gerar mês'}
          </button>
        )}
      </div>

      <div className="px-6 flex flex-col gap-4">

        {/* Card financeiro */}
        <div className="flex flex-col gap-5 p-5 rounded-[20px]" style={{ background: 'var(--color-surface-primary)' }}>

          {/* Saldo Total */}
          <div className="flex flex-col gap-2">
            <p style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-14)' }}>
              Saldo Total
            </p>
            <p className="font-semibold" style={{ color: 'var(--color-fg-accent)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-24)', lineHeight: '28px' }}>
              R$ {saldoTotal.toFixed(2)}
            </p>
          </div>

          {/* Quadra Mensal */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <p style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-14)' }}>
                Quadra Mensal
              </p>
              {isAdmin && !editingQuadra && (
                <button onClick={() => { setEditingQuadra(true); setQuadraValue(String(quadraCost)) }}>
                  <PencilSimple size={14} color="var(--color-fg-secondary)" />
                </button>
              )}
              {isAdmin && editingQuadra && (
                <button onClick={() => setEditingQuadra(false)}>
                  <X size={14} color="var(--color-fg-secondary)" />
                </button>
              )}
            </div>
            {editingQuadra ? (
              <div className="flex gap-2">
                <input
                  type="number"
                  value={quadraValue}
                  onChange={e => setQuadraValue(e.target.value)}
                  placeholder="0,00"
                  className="flex-1 px-4 py-2 rounded-full outline-none"
                  style={{ background: 'white', border: '1.5px solid var(--color-border)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)', color: 'var(--color-fg-primary)' }}
                />
                <button
                  onClick={() => saveQuadra.mutate()}
                  disabled={saveQuadra.isPending}
                  className="px-4 py-2 rounded-full font-medium transition-all active:scale-95"
                  style={{ background: 'var(--color-surface-accent)', color: 'white', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-14)' }}>
                  Salvar
                </button>
              </div>
            ) : (
              <p className="font-semibold" style={{ color: 'var(--color-fg-accent)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)' }}>
                R$ {quadraCost.toFixed(2)}
              </p>
            )}
          </div>

          {/* Avulso Recebido */}
          <div className="flex flex-col gap-2">
            <p style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-14)' }}>
              Valor Avulso Recebido
            </p>
            <p className="font-semibold" style={{ color: 'var(--color-fg-accent)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)' }}>
              R$ {avulsoPaid.toFixed(2)}
            </p>
          </div>

          {/* Avulso Pendente */}
          <div className="flex flex-col gap-2">
            <p style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-14)' }}>
              Valor Avulso Pendente
            </p>
            <p className="font-semibold" style={{ color: avulsoPending > 0 ? 'var(--color-danger)' : 'var(--color-fg-accent)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)' }}>
              R$ {avulsoPending.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'var(--color-border)' }} />

        {/* ATENÇÃO JOVENS */}
        <div className="flex flex-col gap-6 px-1 pb-2">
          <p className="font-medium text-center" style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-14)' }}>
            ATENÇÃO JOVENS
          </p>

          {/* Valores lado a lado */}
          <div className="flex gap-6">
            <div className="flex-1 flex flex-col gap-2">
              <p style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-14)' }}>
                Valor do Mensalista:
              </p>
              <p className="font-semibold" style={{ color: 'var(--color-fg-accent)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-24)', lineHeight: '28px' }}>
                R$ 88,00
              </p>
            </div>
            <div className="flex-1 flex flex-col gap-2">
              <p style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-14)' }}>
                Valor do Avulso:
              </p>
              <p className="font-semibold" style={{ color: 'var(--color-fg-accent)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-24)', lineHeight: '28px' }}>
                R$ 22,00
              </p>
            </div>
          </div>

          {/* Botão PIX */}
          <button
            onClick={handleCopyPix}
            className="w-full py-4 flex items-center justify-center gap-2 font-medium transition-all active:scale-95"
            style={{ background: 'var(--color-surface-accent)', color: 'white', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)' }}>
            {pixCopied ? <Check size={18} /> : <Copy size={18} />}
            {pixCopied ? 'Copiado!' : 'Copiar Código PIX'}
          </button>
        </div>

        {/* Divider */}
        {Object.keys(byMonth).length > 0 && (
          <div style={{ height: 1, background: 'var(--color-border)' }} />
        )}

        {/* Pagamentos por jogo */}
        {jogoPayments.length > 0 && (
          <section>
            <p className="font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-fg-secondary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-12)' }}>
              Por jogo — avulsos (R$22)
            </p>
            <div className="flex flex-col gap-2">
              {jogoPayments.map(p => (
                <PaymentRow key={p.id} payment={p} onToggle={() => togglePaid.mutate({ id: p.id, paid: p.paid })} isAdmin={isAdmin} />
              ))}
            </div>
          </section>
        )}

        {/* Mensalidades por mês */}
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
                {monthPayments.map(p => (
                  <PaymentRow key={p.id} payment={p} onToggle={() => togglePaid.mutate({ id: p.id, paid: p.paid })} isAdmin={isAdmin} />
                ))}
              </div>
            </section>
          )
        })}

        {payments.length === 0 && (
          <div className="text-center py-12">
            <div className="text-5xl mb-4">💰</div>
            <p className="font-medium" style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)' }}>Nenhum pagamento ainda</p>
          </div>
        )}
      </div>
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
          {payment.paid && payment.paid_at ? `Pago em ${format(new Date(payment.paid_at), 'd/MM/yyyy')}` : 'Pendente'}
        </p>
      </div>
      <p className="font-semibold" style={{ color: payment.paid ? 'var(--color-success)' : 'var(--color-danger)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)' }}>
        R$ {payment.amount}
      </p>
    </button>
  )
}

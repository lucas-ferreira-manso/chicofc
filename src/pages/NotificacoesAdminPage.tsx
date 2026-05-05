import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { collection, getDocs, doc, updateDoc, addDoc, query, where } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useState } from 'react'
import { X, CheckCircle } from '@phosphor-icons/react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface PaymentRequest {
  id: string
  user_id: string
  user_name: string
  player_type: string
  amount: number
  month: string
  status: 'pending' | 'approved'
  created_at: string
}

async function fetchRequests(): Promise<PaymentRequest[]> {
  const q = query(collection(db, 'payment_requests'), where('status', '==', 'pending'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as PaymentRequest))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export default function NotificacoesAdminPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [checked, setChecked] = useState<Set<string>>(new Set())

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['payment-requests'],
    queryFn: fetchRequests
  })

  const toggleCheck = (id: string) => {
    setChecked(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const approveAll = useMutation({
    mutationFn: async () => {
      const toApprove = requests.filter(r => checked.has(r.id))
      await Promise.all(toApprove.map(async r => {
        // Atualiza status do request
        await updateDoc(doc(db, 'payment_requests', r.id), { status: 'approved', approved_at: new Date().toISOString() })
        // Marca pagamento como pago no payments
        const month = r.month
        const q = query(collection(db, 'payments'),
          where('user_id', '==', r.user_id),
          where('month', '==', month),
          where('type', '==', 'mensalidade')
        )
        const existing = await getDocs(q)
        if (!existing.empty) {
          await updateDoc(doc(db, 'payments', existing.docs[0].id), {
            paid: true,
            paid_at: new Date().toISOString()
          })
        } else {
          // Cria o pagamento se não existir
          await addDoc(collection(db, 'payments'), {
            user_id: r.user_id,
            amount: r.amount,
            type: r.player_type === 'mensalista' ? 'mensalidade' : 'jogo',
            month,
            paid: true,
            paid_at: new Date().toISOString(),
            created_at: new Date().toISOString()
          })
        }
      }))
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payment-requests'] })
      qc.invalidateQueries({ queryKey: ['payments'] })
      toast.success(`${checked.size} pagamento(s) aprovado(s)!`)
      navigate(-1)
    },
    onError: () => toast.error('Erro ao aprovar pagamentos')
  })

  return (
    <div className="flex flex-col min-h-full" style={{ background: 'var(--color-bg)' }}>

      {/* Header */}
      <div className="px-6 pt-12 pb-4 flex items-center justify-between" style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
        <p style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-24)', fontWeight: 600 }}>Notificações</p>
        <button onClick={() => navigate(-1)}>
          <X size={24} color="var(--color-fg-primary)" />
        </button>
      </div>

      <div className="px-6 pt-4 pb-2">
        <p style={{ color: 'var(--color-fg-secondary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-14)' }}>
          Confirmar pagamentos
        </p>
      </div>

      {/* Lista */}
      <div className="flex-1 px-6 flex flex-col gap-2 pb-32">
        {isLoading ? (
          <div className="flex justify-center py-8"><div className="text-4xl animate-spin">⚽</div></div>
        ) : requests.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">✅</div>
            <p style={{ color: 'var(--color-fg-secondary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)' }}>Nenhum pagamento pendente</p>
          </div>
        ) : requests.map(r => {
          const isChecked = checked.has(r.id)
          const [year, m] = r.month.split('-')
          const monthLabel = format(new Date(Number(year), Number(m) - 1, 1), 'MMMM yyyy', { locale: ptBR })
          return (
            <button key={r.id} onClick={() => toggleCheck(r.id)}
              className="w-full flex items-center gap-3 p-4 rounded-3xl transition-all active:scale-[0.99]"
              style={{ background: isChecked ? 'var(--color-surface-accent-light)' : 'var(--color-surface-primary)', border: isChecked ? '1.5px solid var(--color-fg-accent-light)' : '1.5px solid transparent' }}>
              {/* Checkbox */}
              <div className="w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all"
                style={{ borderColor: isChecked ? '#089527' : 'var(--color-fg-secondary)', background: isChecked ? '#089527' : 'transparent' }}>
                {isChecked && <CheckCircle size={16} weight="fill" color="white" />}
              </div>
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold shrink-0"
                style={{ background: 'var(--color-avatar-bg)', color: 'var(--color-avatar-fg)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)' }}>
                {(r.user_name || '?')[0].toUpperCase()}
              </div>
              {/* Info */}
              <div className="flex-1 text-left">
                <p style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)', fontWeight: 500 }}>{r.user_name}</p>
                <p style={{ color: 'var(--color-fg-secondary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-12)', textTransform: 'capitalize' }}>
                  {r.player_type} · {monthLabel}
                </p>
              </div>
              {/* Valor */}
              <p style={{ color: 'var(--color-fg-accent)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)', fontWeight: 700 }}>
                R$ {r.amount}
              </p>
            </button>
          )
        })}
      </div>

      {/* Botão salvar */}
      {requests.length > 0 && (
        <div className="fixed inset-x-0 px-6 pt-4 pb-8"
          style={{ bottom: 0, background: 'var(--color-bg)', borderTop: '1px solid var(--color-border)' }}>
          <button onClick={() => approveAll.mutate()} disabled={checked.size === 0 || approveAll.isPending}
            className="w-full py-4 font-medium transition-all active:scale-95 disabled:opacity-40"
            style={{ background: checked.size > 0 ? 'var(--btn-primary-bg)' : 'var(--color-surface-secondary)', color: checked.size > 0 ? 'var(--btn-primary-fg)' : 'var(--color-fg-secondary)', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)', fontWeight: 500 }}>
            {approveAll.isPending ? 'Aprovando...' : checked.size > 0 ? `Aprovar ${checked.size} pagamento(s)` : 'Selecione pagamentos para aprovar'}
          </button>
        </div>
      )}
    </div>
  )
}

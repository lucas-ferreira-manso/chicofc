import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { collection, getDocs, doc, updateDoc, addDoc, deleteDoc, query, where, writeBatch } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { ref, deleteObject } from 'firebase/storage'
import { storage } from '../lib/firebase'
import { saveCaixinhaSummary } from './CaixinhaPage'
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
  is_for_temp_avulso?: boolean
  temp_avulso_ids?: string[]
  game_id?: string
  comprovante_url?: string
  comprovante_path?: string
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
  const [selectedRequest, setSelectedRequest] = useState<PaymentRequest | null>(null)

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['payment-requests'],
    queryFn: fetchRequests,
    refetchInterval: 8000
  })

  const toggleCheck = (id: string) => {
    setChecked(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // Função reutilizável para aprovar um ou mais requests
  async function approveRequests(toApprove: PaymentRequest[]) {
      await Promise.all(toApprove.map(async r => {
        await updateDoc(doc(db, 'payment_requests', r.id), {
          status: 'approved',
          approved_at: new Date().toISOString()
        })
        const month = r.month
        const tipo = r.player_type === 'mensalista' ? 'mensalidade' : 'jogo'

        if (tipo === 'jogo') {
          if (r.is_for_temp_avulso && (r as any).temp_avulso_ids?.length > 0) {
            const batch = writeBatch(db)
            ;(r as any).temp_avulso_ids.forEach((id: string) =>
              batch.update(doc(db, 'avulsos_temp', id), { paid: true, paid_at: new Date().toISOString() })
            )
            await batch.commit()
            await addDoc(collection(db, 'payments'), { user_id: r.user_id, amount: r.amount, type: 'jogo', month, paid: true, paid_at: new Date().toISOString(), created_at: new Date().toISOString() })
          } else {
            const q = query(collection(db, 'payments'), where('user_id', '==', r.user_id), where('type', '==', 'jogo'), where('paid', '==', false))
            const existing = await getDocs(q)
            if (!existing.empty) {
              await updateDoc(doc(db, 'payments', existing.docs[0].id), { paid: true, paid_at: new Date().toISOString() })
            } else {
              await addDoc(collection(db, 'payments'), { user_id: r.user_id, amount: r.amount, type: 'jogo', month, paid: true, paid_at: new Date().toISOString(), created_at: new Date().toISOString() })
            }
          }
        } else {
          const q = query(collection(db, 'payments'), where('user_id', '==', r.user_id), where('month', '==', month), where('type', '==', 'mensalidade'))
          const existing = await getDocs(q)
          if (!existing.empty) {
            await updateDoc(doc(db, 'payments', existing.docs[0].id), { paid: true, paid_at: new Date().toISOString() })
          } else {
            await addDoc(collection(db, 'payments'), { user_id: r.user_id, amount: r.amount, type: 'mensalidade', month, paid: true, paid_at: new Date().toISOString(), created_at: new Date().toISOString() })
          }
        }
      }))

      // Após confirmar todos os pagamentos, deleta os comprovantes do Storage
      // para proteger dados bancários dos jogadores
      await Promise.allSettled(
        toApprove
          .filter(r => r.comprovante_path)
          .map(r => deleteObject(ref(storage, r.comprovante_path!)))
      )
  }

  const approveOne = useMutation({
    mutationFn: async (r: PaymentRequest) => approveRequests([r]),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payment-requests'] })
      qc.invalidateQueries({ queryKey: ['payments'] })
      saveCaixinhaSummary()
      setSelectedRequest(null)
      toast.success('Pagamento aprovado!')
    },
    onError: () => toast.error('Erro ao aprovar pagamento')
  })

  const rejectOne = useMutation({
    mutationFn: async (r: PaymentRequest) => {
      // Deleta o comprovante do Storage (se houver)
      if (r.comprovante_path) {
        await deleteObject(ref(storage, r.comprovante_path)).catch(() => {})
      }
      // Notifica o jogador
      await addDoc(collection(db, 'notifications'), {
        user_id: r.user_id,
        title: 'Pagamento negado',
        message: 'Seu comprovante foi recusado. Verifique e envie novamente.',
        type: 'payment_request',
        read: false,
        created_at: new Date().toISOString()
      })
      // Remove o payment_request — jogador fica livre para submeter de novo
      await deleteDoc(doc(db, 'payment_requests', r.id))
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payment-requests'] })
      qc.invalidateQueries({ queryKey: ['my-payment-request'] })
      setSelectedRequest(null)
      toast('Pagamento negado. Jogador notificado.')
    },
    onError: () => toast.error('Erro ao negar pagamento')
  })

  const approveAll = useMutation({
    mutationFn: async () => {
      const toApprove = requests.filter(r => checked.has(r.id))
      await approveRequests(toApprove)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payment-requests'] })
      qc.invalidateQueries({ queryKey: ['payments'] })
      saveCaixinhaSummary()
      toast.success(`${checked.size} pagamento(s) aprovado(s)!`)
      navigate(-1)
    },
    onError: () => toast.error('Erro ao aprovar pagamentos')
  })

  return (
    <div className="flex flex-col" style={{ minHeight: '100dvh', background: 'var(--color-bg)' }}>

      {/* Header */}
      <div className="px-6 pt-12 pb-4 flex items-center justify-between shrink-0"
        style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
        <p style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-24)', fontWeight: 600 }}>
          Notificações
        </p>
        <button onClick={() => navigate(-1)} className="w-8 h-8 flex items-center justify-center">
          <X size={24} color="var(--color-fg-primary)" />
        </button>
      </div>

      {/* Subtítulo */}
      <div className="px-6 pt-4 pb-2 shrink-0">
        <p style={{ color: 'var(--color-fg-secondary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)', fontWeight: 500 }}>
          Confirmar pagamentos
        </p>
      </div>

      {/* Lista — cresce mas deixa espaço para o botão */}
      <div className="flex-1 px-6 flex flex-col gap-2 pb-4" style={{ overflowY: 'auto' }}>
        {isLoading ? (
          <div className="flex justify-center py-8"><div className="text-4xl animate-spin">⚽</div></div>
        ) : requests.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">✅</div>
            <p style={{ color: 'var(--color-fg-secondary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)' }}>
              Nenhum pagamento pendente
            </p>
          </div>
        ) : requests.map(r => {
          const isChecked = checked.has(r.id)
          // Proteção contra month undefined/nulo em requests antigos
          const safeMonth = r.month || format(new Date(), 'yyyy-MM')
          const parts = safeMonth.split('-')
          const monthLabel = format(
            new Date(Number(parts[0]), Number(parts[1]) - 1, 1),
            'MMMM yyyy',
            { locale: ptBR }
          )
          const typeLabel = r.is_for_temp_avulso
            ? `Avulso temp${r.temp_avulso_ids?.length ? ` (${r.temp_avulso_ids.length})` : ''}`
            : r.player_type === 'mensalista' ? 'Mensalidade' : 'Avulso'
          return (
            <button key={r.id} onClick={() => r.comprovante_url ? setSelectedRequest(r) : toggleCheck(r.id)}
              className="w-full flex items-center gap-3 p-4 rounded-3xl transition-all active:scale-[0.99]"
              style={{
                background: isChecked ? 'var(--color-surface-accent-light)' : 'var(--color-surface-primary)',
                border: isChecked ? '1.5px solid var(--color-fg-accent-light)' : '1.5px solid transparent'
              }}>
              {/* Radio */}
              <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all"
                style={{ borderColor: isChecked ? '#089527' : 'var(--color-fg-secondary)', background: isChecked ? '#089527' : 'transparent' }}>
                {isChecked && <div className="w-2 h-2 rounded-full bg-white" />}
              </div>
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold shrink-0"
                style={{ background: 'var(--color-avatar-bg)', color: 'var(--color-avatar-fg)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)' }}>
                {(r.user_name || '?')[0].toUpperCase()}
              </div>
              {/* Info */}
              <div className="flex-1 text-left">
                <p style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)', fontWeight: 500 }}>
                  {r.user_name}
                </p>
                <p style={{ color: 'var(--color-fg-secondary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-12)', textTransform: 'capitalize' }}>
                  {typeLabel} · {monthLabel}
                </p>
              </div>
              {/* Valor + indicador de comprovante */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                <p style={{ color: 'var(--color-fg-accent)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)', fontWeight: 700 }}>
                  R$ {r.amount}
                </p>
                {r.comprovante_url && (
                  <p style={{ fontFamily: 'var(--font-primary)', fontSize: 10, color: '#089527', fontWeight: 600 }}>📎 comprovante</p>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Botão Salvar — sempre visível no rodapé */}
      <div className="shrink-0 px-6 pt-4 pb-8"
        style={{ background: 'var(--color-bg)', borderTop: '1px solid var(--color-border)' }}>
        <button
          onClick={() => approveAll.mutate()}
          disabled={checked.size === 0 || approveAll.isPending}
          className="w-full py-4 font-medium transition-all active:scale-95 disabled:opacity-40"
          style={{
            background: checked.size > 0 ? 'var(--btn-primary-bg)' : 'var(--color-surface-secondary)',
            color: checked.size > 0 ? 'var(--btn-primary-fg)' : 'var(--color-fg-secondary)',
            borderRadius: 'var(--radius-pill)',
            fontFamily: 'var(--font-primary)',
            fontSize: 'var(--font-size-16)',
            fontWeight: 500
          }}>
          {approveAll.isPending
            ? 'Aprovando...'
            : checked.size > 0
            ? `Salvar (${checked.size} pagamento${checked.size > 1 ? 's' : ''})`
            : 'Salvar'}
        </button>
      </div>

      {/* Bottom Sheet — Comprovante (admin vê ao tocar num request com comprovante) */}
      {selectedRequest && (
        <>
          <div onClick={() => setSelectedRequest(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 60 }} />
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 70, background: 'var(--color-bg)', borderRadius: '24px 24px 0 0', padding: '24px 24px calc(40px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Close */}
            <button onClick={() => setSelectedRequest(null)} style={{ position: 'absolute', top: 20, right: 20, width: 32, height: 32, borderRadius: '50%', background: 'var(--color-surface-primary)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={16} color="var(--color-fg-secondary)" />
            </button>

            {/* Info do jogador */}
            <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 600, fontSize: 16, color: 'var(--color-fg-primary)' }}>
              Confirmar pagamento
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--color-avatar-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontFamily: 'var(--font-primary)', fontSize: 16, color: 'var(--color-avatar-fg)', flexShrink: 0 }}>
                {(selectedRequest.user_name || '?')[0].toUpperCase()}
              </div>
              <div>
                <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 500, fontSize: 16, color: 'var(--color-fg-primary)' }}>{selectedRequest.user_name}</p>
                <p style={{ fontFamily: 'var(--font-primary)', fontSize: 12, color: 'var(--color-fg-secondary)' }}>
                  {selectedRequest.is_for_temp_avulso ? 'Avulso temporário' : selectedRequest.player_type === 'mensalista' ? 'Mensalidade' : 'Avulso'} · R$ {selectedRequest.amount}
                </p>
              </div>
            </div>

            {/* Preview comprovante */}
            {selectedRequest.comprovante_url && (
              <div style={{ background: 'var(--color-surface-primary)', borderRadius: 16, padding: 16, display: 'flex', justifyContent: 'center' }}>
                <img src={selectedRequest.comprovante_url} alt="Comprovante" style={{ maxHeight: 220, maxWidth: '100%', objectFit: 'contain', borderRadius: 8 }} />
              </div>
            )}

            {/* Botões Aprovar / Negar */}
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => rejectOne.mutate(selectedRequest)}
                disabled={rejectOne.isPending || approveOne.isPending}
                className="transition-all active:scale-95 disabled:opacity-40"
                style={{ flex: 1, height: 56, borderRadius: 9999, background: 'var(--color-surface-primary)', color: '#ef4444', fontFamily: 'var(--font-primary)', fontWeight: 500, fontSize: 16, border: '1.5px solid #ef4444', cursor: 'pointer' }}>
                {rejectOne.isPending ? 'Negando...' : 'Negar'}
              </button>
              <button
                onClick={() => approveOne.mutate(selectedRequest)}
                disabled={approveOne.isPending || rejectOne.isPending}
                className="transition-all active:scale-95 disabled:opacity-40"
                style={{ flex: 1, height: 56, borderRadius: 9999, background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-fg)', fontFamily: 'var(--font-primary)', fontWeight: 500, fontSize: 16, border: 'none', cursor: 'pointer' }}>
                {approveOne.isPending ? 'Aprovando...' : 'Aprovar'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

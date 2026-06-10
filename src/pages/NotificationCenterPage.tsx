import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  collection, getDocs, query, where, doc,
  updateDoc, addDoc, writeBatch, deleteDoc
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuthStore } from '../store/authStore'
import { X } from '@phosphor-icons/react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'

// ─── Types ───────────────────────────────────────────────────────────────────

interface AppNotification {
  id: string
  user_id: string
  title: string
  message?: string
  type: 'message' | 'payment_request'
  payment_request_id?: string
  read: boolean
  created_at: string
}

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
  comprovante_url?: string
  comprovante_path?: string
  comprovante_base64?: string
}

// ─── Fetchers ─────────────────────────────────────────────────────────────────

async function fetchMyNotifications(userId: string): Promise<AppNotification[]> {
  const q = query(
    collection(db, 'notifications'),
    where('user_id', '==', userId)
  )
  const snap = await getDocs(q)
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as AppNotification))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
}

async function fetchPendingRequests(): Promise<PaymentRequest[]> {
  const q = query(collection(db, 'payment_requests'), where('status', '==', 'pending'))
  const snap = await getDocs(q)
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as PaymentRequest))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function NotificationCenterPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const user = useAuthStore(s => s.user)
  const isAdmin = user?.role === 'admin'

  const [selectedRequest, setSelectedRequest] = useState<PaymentRequest | null>(null)

  // Notifications for current user
  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: () => fetchMyNotifications(user!.id),
    enabled: !!user?.id,
    refetchInterval: 10000
  })

  // Pending payment requests — admin only
  const { data: pendingRequests = [] } = useQuery({
    queryKey: ['payment-requests'],
    queryFn: fetchPendingRequests,
    enabled: isAdmin,
    refetchInterval: 8000
  })

  // Mark all unread as read when notifications load
  const markAllRead = useMutation({
    mutationFn: async () => {
      const unread = notifications.filter(n => !n.read)
      if (unread.length === 0) return
      await Promise.all(unread.map(n => updateDoc(doc(db, 'notifications', n.id), { read: true })))
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications', user?.id] })
      qc.invalidateQueries({ queryKey: ['notifications-unread', user?.id] })
    }
  })

  useEffect(() => {
    if (notifications.length > 0) {
      markAllRead.mutate()
    }
  }, [notifications.length])

  // Approve single payment request (from bottom sheet)
  const approveRequest = useMutation({
    mutationFn: async (r: PaymentRequest) => {
      const now = new Date().toISOString()
      await updateDoc(doc(db, 'payment_requests', r.id), { status: 'approved', approved_at: now })

      const month = r.month
      const tipo = r.player_type === 'mensalista' ? 'mensalidade' : 'jogo'

      if (tipo === 'jogo') {
        if (r.is_for_temp_avulso && r.temp_avulso_ids?.length) {
          const batch = writeBatch(db)
          r.temp_avulso_ids.forEach(id =>
            batch.update(doc(db, 'avulsos_temp', id), { paid: true, paid_at: now })
          )
          await batch.commit()
          await addDoc(collection(db, 'payments'), {
            user_id: r.user_id, amount: r.amount, type: 'jogo',
            month, paid: true, paid_at: now, created_at: now
          })
        } else {
          const q = query(collection(db, 'payments'),
            where('user_id', '==', r.user_id),
            where('type', '==', 'jogo'),
            where('paid', '==', false)
          )
          const existing = await getDocs(q)
          if (!existing.empty) {
            await updateDoc(doc(db, 'payments', existing.docs[0].id), { paid: true, paid_at: now })
          } else {
            await addDoc(collection(db, 'payments'), {
              user_id: r.user_id, amount: r.amount, type: 'jogo',
              month, paid: true, paid_at: now, created_at: now
            })
          }
        }
      } else {
        const q = query(collection(db, 'payments'),
          where('user_id', '==', r.user_id),
          where('month', '==', month),
          where('type', '==', 'mensalidade')
        )
        const existing = await getDocs(q)
        if (!existing.empty) {
          await updateDoc(doc(db, 'payments', existing.docs[0].id), { paid: true, paid_at: now })
        } else {
          await addDoc(collection(db, 'payments'), {
            user_id: r.user_id, amount: r.amount, type: 'mensalidade',
            month, paid: true, paid_at: now, created_at: now
          })
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payment-requests'] })
      qc.invalidateQueries({ queryKey: ['payments'] })
      setSelectedRequest(null)
      toast.success('Pagamento confirmado!')
    },
    onError: () => toast.error('Erro ao confirmar pagamento')
  })

  const rejectRequest = useMutation({
    mutationFn: async (r: PaymentRequest) => {
      await addDoc(collection(db, 'notifications'), {
        user_id: r.user_id,
        title: 'Pagamento negado',
        message: 'Seu comprovante foi recusado. Verifique e envie novamente.',
        type: 'payment_request',
        read: false,
        created_at: new Date().toISOString()
      })
      await deleteDoc(doc(db, 'payment_requests', r.id))
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payment-requests'] })
      setSelectedRequest(null)
      toast('Pagamento negado. Jogador notificado.')
    },
    onError: () => toast.error('Erro ao negar pagamento')
  })

  const isEmpty = notifications.length === 0 && (!isAdmin || pendingRequests.length === 0)

  return (
    <div className="flex flex-col" style={{ minHeight: '100dvh', background: 'var(--color-bg)' }}>

      {/* Header */}
      <div
        className="fixed top-0 inset-x-0 z-40 flex items-center justify-between px-6 py-4"
        style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
        <p style={{
          fontFamily: 'var(--font-primary)', fontWeight: 600,
          fontSize: 'var(--font-size-24)', lineHeight: '28px',
          color: 'var(--color-fg-primary)'
        }}>
          Notificações
        </p>
        <button
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <X size={24} color="var(--color-fg-primary)" />
        </button>
      </div>

      <div style={{ height: 80 }} />

      {/* List */}
      <div className="flex flex-col gap-2 px-6 py-2 pb-10">

        {isEmpty ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">🔔</div>
            <p style={{
              color: 'var(--color-fg-secondary)', fontFamily: 'var(--font-primary)',
              fontSize: 'var(--font-size-16)'
            }}>
              Nenhuma notificação ainda
            </p>
          </div>
        ) : (
          <>
            {/* Payment requests — admin only */}
            {isAdmin && pendingRequests.map(r => (
              <NotificationItem
                key={`pr-${r.id}`}
                type="payment"
                isNew={true}
                title="Confirmar Pagamento"
                message={`${r.user_name} realizou pagamento`}
                onPress={() => setSelectedRequest(r)}
              />
            ))}

            {/* Messages */}
            {notifications.map(n => (
              <NotificationItem
                key={n.id}
                type="message"
                isNew={!n.read}
                title={n.title}
                message={n.message}
              />
            ))}
          </>
        )}
      </div>

      {/* Bottom sheet — confirm payment */}
      {isAdmin && selectedRequest && (
        <>
          <div
            className="fixed inset-0 z-50"
            style={{ background: 'rgba(0,0,0,0.6)' }}
            onClick={() => setSelectedRequest(null)}
          />
          <div
            className="fixed bottom-0 left-0 right-0 z-60 px-6 pt-6 pb-10 flex flex-col gap-6"
            style={{ background: 'var(--color-bg)', borderRadius: '24px 24px 0 0' }}>
            {/* Close */}
            <button
              onClick={() => setSelectedRequest(null)}
              className="absolute top-5 right-5"
              style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
              <X size={24} color="var(--color-fg-primary)" />
            </button>

            <p style={{
              fontFamily: 'var(--font-primary)', fontWeight: 600,
              fontSize: 'var(--font-size-16)', color: 'var(--color-fg-primary)'
            }}>
              Confirmar pagamento
            </p>

            {/* Info do jogador */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--color-avatar-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16, color: 'var(--color-avatar-fg)', flexShrink: 0 }}>
                {(selectedRequest.user_name || '?')[0].toUpperCase()}
              </div>
              <div>
                <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 500, fontSize: 'var(--font-size-16)', color: 'var(--color-fg-primary)' }}>
                  {selectedRequest.user_name}
                </p>
                <p style={{ fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-12)', color: 'var(--color-fg-secondary)' }}>
                  {selectedRequest.is_for_temp_avulso
                    ? `Avulso temp${selectedRequest.temp_avulso_ids?.length ? ` (${selectedRequest.temp_avulso_ids.length})` : ''}`
                    : selectedRequest.player_type === 'mensalista' ? 'Mensalidade' : 'Avulso'
                  }
                  {' · R$ '}{selectedRequest.amount}
                  {' · '}
                  {(() => {
                    const m = (selectedRequest.month || '').split('-')
                    try { return format(new Date(Number(m[0]), Number(m[1]) - 1, 1), 'MMMM yyyy', { locale: ptBR }) }
                    catch { return selectedRequest.month }
                  })()}
                </p>
              </div>
            </div>

            {/* Comprovante */}
            {(selectedRequest.comprovante_base64 || selectedRequest.comprovante_url) && (
              <div style={{ background: 'var(--color-surface-primary)', borderRadius: 16, padding: 16, display: 'flex', justifyContent: 'center' }}>
                <img
                  src={selectedRequest.comprovante_base64 || selectedRequest.comprovante_url}
                  alt="Comprovante"
                  style={{ maxHeight: 260, maxWidth: '100%', objectFit: 'contain', borderRadius: 8 }}
                />
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => rejectRequest.mutate(selectedRequest)}
                disabled={rejectRequest.isPending || approveRequest.isPending}
                className="flex-1 py-4 rounded-full font-medium transition-all active:scale-95 disabled:opacity-40"
                style={{
                  background: 'var(--color-surface-primary)',
                  color: '#ef4444',
                  fontFamily: 'var(--font-primary)',
                  fontSize: 'var(--font-size-16)',
                  border: '1.5px solid #ef4444'
                }}>
                {rejectRequest.isPending ? 'Negando...' : 'Negar'}
              </button>
              <button
                onClick={() => approveRequest.mutate(selectedRequest)}
                disabled={approveRequest.isPending || rejectRequest.isPending}
                className="flex-1 py-4 rounded-full font-medium transition-all active:scale-95 disabled:opacity-40"
                style={{
                  background: 'var(--btn-primary-bg)',
                  color: 'var(--btn-primary-fg)',
                  fontFamily: 'var(--font-primary)',
                  fontSize: 'var(--font-size-16)',
                  border: 'none'
                }}>
                {approveRequest.isPending ? 'Aprovando...' : 'Aprovar'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── NotificationItem ─────────────────────────────────────────────────────────

function NotificationItem({
  type, isNew, title, message, onPress
}: {
  type: 'message' | 'payment'
  isNew: boolean
  title: string
  message?: string
  onPress?: () => void
}) {
  const isPayment = type === 'payment'
  const Tag = onPress ? 'button' : 'div'

  return (
    <Tag
      onClick={onPress}
      className="w-full flex items-center gap-2 px-4 transition-all active:scale-[0.99]"
      style={{
        background: 'var(--color-surface-primary)',
        borderRadius: 24,
        height: 70,
        border: 'none',
        cursor: onPress ? 'pointer' : 'default',
        textAlign: 'left'
      }}>
      {/* Dot indicator */}
      <div style={{
        width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
        background: isNew ? 'var(--color-fg-accent)' : 'transparent',
        border: isNew ? 'none' : '1.5px solid var(--color-border)'
      }} />

      {/* Text */}
      <div className="flex-1 min-w-0 flex flex-col">
        <p style={{
          fontFamily: 'var(--font-primary)', fontWeight: 500,
          fontSize: 'var(--font-size-14)', color: 'var(--color-fg-primary)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
        }}>
          {title}
        </p>
        {message && (
          <p style={{
            fontFamily: 'var(--font-primary)', fontWeight: 400,
            fontSize: 'var(--font-size-11)', color: 'var(--color-fg-secondary)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
          }}>
            {message}
          </p>
        )}
      </div>

      {/* Payment arrow indicator */}
      {isPayment && (
        <div style={{
          width: 6, height: 6, borderTop: '2px solid var(--color-fg-secondary)',
          borderRight: '2px solid var(--color-fg-secondary)',
          transform: 'rotate(45deg)', flexShrink: 0, marginRight: 4
        }} />
      )}
    </Tag>
  )
}

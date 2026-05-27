import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { collection, getDocs, doc, updateDoc, addDoc, getDoc, setDoc, query, where, deleteDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuthStore } from '../store/authStore'
import { format, isWednesday, nextWednesday, startOfDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Copy, Check, PencilSimple, X, CheckCircle, Circle, BellRinging } from '@phosphor-icons/react'
import Header from '../components/layout/Header'
import { toast } from 'sonner'
import type { Payment, Profile } from '../types'

const PIX_CODE = '42c4fc79-a983-4a02-88fb-81ec76948c0f'
const SALDO_INICIAL = 1082

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

interface CaixinhaConfig {
  quadraCost: number
  extrasCost: number
  mensalistaValue: number
  avulsoValue: number
}

async function fetchConfig(): Promise<CaixinhaConfig> {
  const snap = await getDoc(doc(db, 'config', 'caixinha'))
  if (!snap.exists()) return { quadraCost: 760, extrasCost: 320, mensalistaValue: 80, avulsoValue: 22 }
  return {
    quadraCost: snap.data().quadraCost ?? 760,
    extrasCost: snap.data().extrasCost ?? 320,
    mensalistaValue: snap.data().mensalistaValue ?? 80,
    avulsoValue: snap.data().avulsoValue ?? 22
  }
}

async function fetchPendingRequests(): Promise<any[]> {
  const q = query(collection(db, 'payment_requests'), where('status', '==', 'pending'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

async function fetchMyPaymentRequest(userId: string, playerType?: string) {
  if (playerType === 'avulso') {
    // Avulsos: só retorna requests PENDENTES do pagamento próprio (não temp avulso)
    const q = query(
      collection(db, 'payment_requests'),
      where('user_id', '==', userId),
      where('status', '==', 'pending')
    )
    const snap = await getDocs(q)
    if (snap.empty) return null
    // Prefere o request do próprio jogo (não temp); se só tiver temp, retorna nulo aqui
    const ownRequest = snap.docs.find(d => !d.data().is_for_temp_avulso)
    if (!ownRequest) return null
    return { id: ownRequest.id, ...ownRequest.data() }
  }
  // Mensalistas: verifica por mês atual, ignorando requests de avulso temporário
  const month = format(new Date(), 'yyyy-MM')
  const q = query(collection(db, 'payment_requests'), where('user_id', '==', userId), where('month', '==', month))
  const snap = await getDocs(q)
  if (snap.empty) return null
  const ownRequest = snap.docs.find(d => !d.data().is_for_temp_avulso)
  if (!ownRequest) return null
  return { id: ownRequest.id, ...ownRequest.data() }
}

async function fetchMyUnpaidJogoPayments(userId: string): Promise<any[]> {
  const q = query(
    collection(db, 'payments'),
    where('user_id', '==', userId),
    where('type', '==', 'jogo'),
    where('paid', '==', false)
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

async function fetchMyCurrentGameAttendance(userId: string, gameId: string): Promise<any | null> {
  const q = query(collection(db, 'attendances'), where('user_id', '==', userId), where('game_id', '==', gameId))
  const snap = await getDocs(q)
  if (snap.empty) return null
  return { id: snap.docs[0].id, ...snap.docs[0].data() }
}

function getNextWednesday(): Date {
  const today = startOfDay(new Date())
  if (isWednesday(today)) return today
  return nextWednesday(today)
}

function getGameId(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

async function fetchMyTempAvulsos(userId: string, gameId: string): Promise<any[]> {
  const q = query(collection(db, 'avulsos_temp'), where('addedBy', '==', userId))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as any)).filter(d => d.gameId === gameId)
}

async function fetchAllTempAvulsos(gameId: string): Promise<any[]> {
  const q = query(collection(db, 'avulsos_temp'), where('gameId', '==', gameId))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as any))
}

type EditField = 'quadra' | 'extras' | 'mensalista' | 'avulso' | null

export default function CaixinhaPage() {
  const qc = useQueryClient()
  const user = useAuthStore(s => s.user)
  const isAdmin = user?.role === 'admin'

  const { data: payments = [] } = useQuery({ queryKey: ['payments'], queryFn: fetchPayments, refetchInterval: 8000 })
  const { data: players = [] } = useQuery({ queryKey: ['players'], queryFn: fetchPlayers })
  const { data: config } = useQuery({ queryKey: ['caixinha-config'], queryFn: fetchConfig })
  const { data: pendingRequests = [] } = useQuery({
    queryKey: ['pending-requests'],
    queryFn: fetchPendingRequests,
    refetchInterval: 8000
  })

  const { data: myRequest } = useQuery({
    queryKey: ['my-payment-request', user?.id, user?.player_type],
    queryFn: () => fetchMyPaymentRequest(user!.id, user?.player_type),
    enabled: !!user?.id,
    refetchInterval: 8000
  })

  const { data: myUnpaidJogoPayments = [] } = useQuery({
    queryKey: ['my-unpaid-jogo', user?.id],
    queryFn: () => fetchMyUnpaidJogoPayments(user!.id),
    enabled: !!user?.id && user?.player_type === 'avulso',
    refetchInterval: 8000
  })

  const currentGameId = getGameId(getNextWednesday())

  const { data: myCurrentGameAttendance } = useQuery({
    queryKey: ['my-game-attendance', user?.id, currentGameId],
    queryFn: () => fetchMyCurrentGameAttendance(user!.id, currentGameId),
    enabled: !!user?.id && user?.player_type === 'avulso',
    refetchInterval: 15000
  })
  const { data: myTempAvulsos = [] } = useQuery({
    queryKey: ['my-temp-avulsos', user?.id, currentGameId],
    queryFn: () => fetchMyTempAvulsos(user!.id, currentGameId),
    enabled: !!user?.id,
    refetchInterval: 15000
  })
  const { data: allTempAvulsos = [] } = useQuery({
    queryKey: ['all-temp-avulsos', currentGameId],
    queryFn: () => fetchAllTempAvulsos(currentGameId),
    enabled: isAdmin,
    refetchInterval: 15000
  })

  const [pixCopied, setPixCopied] = useState(false)
  const [editingField, setEditingField] = useState<EditField>(null)
  const [editValue, setEditValue] = useState('')

  const handleCopyPix = () => {
    navigator.clipboard.writeText(PIX_CODE)
    setPixCopied(true)
    toast.success('PIX copiado!')
    setTimeout(() => setPixCopied(false), 3000)
  }

  const openEdit = (field: EditField, currentValue: number) => {
    setEditingField(field)
    setEditValue(String(currentValue))
  }

  const saveField = useMutation({
    mutationFn: async () => {
      const value = parseFloat(editValue) || 0
      const fieldMap: Record<string, string> = { quadra: 'quadraCost', extras: 'extrasCost', mensalista: 'mensalistaValue', avulso: 'avulsoValue' }
      await setDoc(doc(db, 'config', 'caixinha'), { [fieldMap[editingField!]]: value }, { merge: true })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['caixinha-config'] })
      toast.success('Valor atualizado!')
      setEditingField(null)
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
      const mensalistaValue = config?.mensalistaValue ?? 80
      const q = query(collection(db, 'payments'), where('month', '==', month), where('type', '==', 'mensalidade'))
      const existing = await getDocs(q)
      const existingIds = new Set(existing.docs.map(d => d.data().user_id))
      const mensalistas = players.filter(p => p.player_type === 'mensalista' && !existingIds.has(p.id))
      await Promise.all(mensalistas.map(p => addDoc(collection(db, 'payments'), {
        user_id: p.id, amount: mensalistaValue, type: 'mensalidade', month, paid: false, created_at: new Date().toISOString()
      })))
      return mensalistas.length
    },
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: ['payments'] })
      toast.success(count > 0 ? `${count} mensalidades criadas!` : 'Todos já têm mensalidade')
    }
  })

  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null)

  const deletePayment = useMutation({
    mutationFn: async (payment: Payment) => {
      await deleteDoc(doc(db, 'payments', payment.id))
      // Limpa payment_request pendente do mesmo usuário/mês para não sujar o cálculo
      const q = query(collection(db, 'payment_requests'), where('user_id', '==', (payment as any).user_id), where('status', '==', 'pending'))
      const snap = await getDocs(q)
      const toDelete = snap.docs.filter(d =>
        payment.type === 'mensalidade' ? d.data().month === payment.month : true
      )
      await Promise.all(toDelete.map(d => deleteDoc(d.ref)))
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments'] })
      qc.invalidateQueries({ queryKey: ['pending-requests'] })
      setSelectedPayment(null)
      toast.success('Pagamento removido.')
    }
  })

  // Já paguei — cria payment_request(s) para o admin aprovar.
  // Cobre o pagamento próprio (se ainda pendente) + avulsos temp adicionados (se houver).
  // Total = próprio + R$22 × n_temporários.
  const submitPaymentRequest = useMutation({
    mutationFn: async () => {
      const month = format(new Date(), 'yyyy-MM')
      const playerData = players.find(p => p.id === user?.id)
      const tipo = playerData?.player_type || 'mensalista'
      const ownAmount = tipo === 'mensalista' ? (config?.mensalistaValue ?? 80) : (config?.avulsoValue ?? 22)
      const unpaidTemps = myTempAvulsos.filter((t: any) => !t.paid)

      const ops: Promise<any>[] = []

      // Pagamento próprio — só cria se ainda não foi submetido/aprovado
      if (!hasRequested && !isApproved) {
        ops.push(addDoc(collection(db, 'payment_requests'), {
          user_id: user!.id,
          user_name: user?.name || user?.email,
          player_type: tipo,
          amount: ownAmount,
          month,
          status: 'pending',
          created_at: new Date().toISOString()
        }))
      }

      // Avulsos temporários — um request separado cobrindo todos de uma vez
      if (unpaidTemps.length > 0 && !hasPendingTempAvulsoRequest) {
        ops.push(addDoc(collection(db, 'payment_requests'), {
          user_id: user!.id,
          user_name: user?.name || user?.email,
          player_type: 'avulso',
          amount: (config?.avulsoValue ?? 22) * unpaidTemps.length,
          month,
          status: 'pending',
          is_for_temp_avulso: true,
          game_id: currentGameId,
          created_at: new Date().toISOString()
        }))
      }

      if (ops.length > 0) await Promise.all(ops)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-payment-request', user?.id] })
      qc.invalidateQueries({ queryKey: ['pending-requests'] })
      toast.success('Admin notificado! Aguarde aprovação.')
    },
    onError: () => toast.error('Erro ao notificar. Tente novamente.')
  })

  // Cálculos
  const jogoPayments = payments.filter(p => p.type === 'jogo')
  const despesaPayments = payments.filter(p => p.type === 'despesa')
  const totalDespesas = despesaPayments.reduce((s, p) => s + p.amount, 0)
  const mensalidadePayments = payments.filter(p => p.type === 'mensalidade')
  const avulsoValue = config?.avulsoValue ?? 22
  const avulsoPaid = jogoPayments.filter(p => p.paid).reduce((s, p) => s + p.amount, 0)
  // Usuários que já têm um payment_request de avulso pendente cobrem tudo (próprio + temps)
  // → não conta o jogo deles em separado (evita dupla contagem)
  const userIdsComPendingAvulsoRequest = new Set(
    (pendingRequests as any[]).filter(r => r.player_type === 'avulso').map(r => r.user_id)
  )
  const avulsoFromPayments = jogoPayments
    .filter(p => !p.paid && !userIdsComPendingAvulsoRequest.has(p.user_id))
    .reduce((s, p) => s + p.amount, 0)
  // Requests de avulso pendentes (cobrem jogo próprio e/ou temps) — somamos o amount direto
  const avulsoFromRequests = (pendingRequests as any[])
    .filter(r => r.player_type === 'avulso')
    .reduce((s: number, r: any) => s + r.amount, 0)
  // Temp avulsos sem rastreamento: não pagos E addedBy sem request pendente de avulso
  const avulsoFromTempAvulsos = (allTempAvulsos as any[])
    .filter(t => !t.paid && !userIdsComPendingAvulsoRequest.has(t.addedBy))
    .reduce((s: number, _: any) => s + avulsoValue, 0)
  const avulsoPending = avulsoFromPayments + avulsoFromRequests + avulsoFromTempAvulsos
  const mensalistaPaid = mensalidadePayments.filter(p => p.paid).reduce((s, p) => s + p.amount, 0)
  // Inclui payment_requests pendentes no cálculo de pendente
  const mensalistaPendingFromPayments = mensalidadePayments.filter(p => !p.paid).reduce((s, p) => s + p.amount, 0)
  const mensalistaPendingFromRequests = pendingRequests.filter(r => r.player_type === 'mensalista').reduce((s: number, r: any) => s + r.amount, 0)
  const mensalistaPending = mensalistaPendingFromPayments + mensalistaPendingFromRequests
  const quadraCost = config?.quadraCost ?? 760
  const extrasCost = config?.extrasCost ?? 0
  const mensalistaValue = config?.mensalistaValue ?? 80
  const saldoTotal = SALDO_INICIAL + avulsoPaid + mensalistaPaid - totalDespesas - extrasCost

  const byMonth = mensalidadePayments.reduce((acc, p) => {
    if (!acc[p.month]) acc[p.month] = []
    acc[p.month].push(p)
    return acc
  }, {} as Record<string, Payment[]>)

  const playerData = players.find(p => p.id === user?.id)
  const isAvulso = user?.player_type === 'avulso'
  const myAmount = isAvulso ? avulsoValue : mensalistaValue
  // Para avulsos, fetchMyPaymentRequest só retorna pendentes do próprio jogo (não temp avulso)
  const hasRequested = !!myRequest && (myRequest as any).status === 'pending'
  const isApproved = !isAvulso && !!myRequest && (myRequest as any).status === 'approved'
  // Avulsos veem botões de pagamento se têm jogo pendente OU estão na lista de espera/confirmados
  const avulsoInGame = !!myCurrentGameAttendance && ['confirmed', 'waitlist'].includes(myCurrentGameAttendance.status)
  const avulsoNeedsPay = isAvulso && (myUnpaidJogoPayments.length > 0 || avulsoInGame)
  // Estado do avulso temporário adicionado pelo usuário
  const hasPendingTempAvulsoRequest = (pendingRequests as any[]).some(
    r => r.user_id === user?.id && r.is_for_temp_avulso === true
  )
  const unpaidTempAvulsos = myTempAvulsos.filter((t: any) => !t.paid)
  const hasTempAvulsoPending = unpaidTempAvulsos.length > 0 && !hasPendingTempAvulsoRequest
  const ownAmount = isAvulso ? avulsoValue : mensalistaValue
  const tempTotalAmount = unpaidTempAvulsos.length * avulsoValue

  const EditableRow = ({ field, label, value }: { field: EditField, label: string, value: number }) => (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <p style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-12)', lineHeight: '16px', fontWeight: 600 }}>{label}</p>
        {isAdmin && editingField !== field && <button onClick={() => openEdit(field, value)}><PencilSimple size={11} color="var(--color-fg-secondary)" /></button>}
        {isAdmin && editingField === field && <button onClick={() => setEditingField(null)}><X size={11} color="var(--color-fg-secondary)" /></button>}
      </div>
      {editingField === field ? (
        <div className="flex gap-1.5">
          <input type="number" value={editValue} onChange={e => setEditValue(e.target.value)}
            className="outline-none rounded-full px-3 py-1"
            style={{ background: 'var(--color-surface-secondary)', border: '1.5px solid var(--color-border)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-14)', color: 'var(--color-fg-primary)', width: 80 }} />
          <button onClick={() => saveField.mutate()} disabled={saveField.isPending}
            className="px-3 py-1 rounded-full font-medium text-xs disabled:opacity-40"
            style={{ background: 'var(--color-surface-accent)', color: 'white', fontFamily: 'var(--font-primary)' }}>OK</button>
        </div>
      ) : (
        <p style={{ color: 'var(--color-fg-accent)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)', fontWeight: 600 }}>R$ {value.toFixed(2)}</p>
      )}
    </div>
  )

  return (
    <div className="flex flex-col min-h-full pb-28" style={{ background: 'var(--color-bg)' }}>
      <Header
        title="Caixinha"
        subtitle={`Total de usuários: ${players.length}`}
        rightContent={isAdmin ? (
          <button onClick={() => generateMonth.mutate()} disabled={generateMonth.isPending}
            className="px-4 py-2 rounded-full font-medium transition-all active:scale-95 disabled:opacity-40"
            style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-fg)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-14)' }}>
            {generateMonth.isPending ? '...' : 'Gerar mês'}
          </button>
        ) : undefined}
      />
      <div style={{ height: 96 }} />

            <div className="px-6 flex flex-col gap-4">

        {/* Card financeiro */}
        <div className="flex flex-col gap-5 p-5 rounded-[20px]" style={{ background: 'var(--color-surface-primary)' }}>
          <div className="flex flex-col gap-2">
            <p style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-14)', fontWeight: 500 }}>Saldo Total</p>
            <p style={{ color: 'var(--color-fg-accent)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-24)', lineHeight: '28px', fontWeight: 600 }}>R$ {saldoTotal.toFixed(2)}</p>
          </div>
          <div className="flex gap-5">
            <div className="flex-1"><EditableRow field="quadra" label="Despesa Quadra" value={quadraCost} /></div>
            <div className="flex-1"><EditableRow field="extras" label="Despesas Extras" value={extrasCost} /></div>
          </div>
          <div className="flex gap-5">
            <div className="flex-1 flex flex-col gap-0.5">
              <p style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-12)', lineHeight: '16px', fontWeight: 600 }}>Mensalista Recebido</p>
              <p style={{ color: 'var(--color-fg-accent)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)', fontWeight: 600 }}>R$ {mensalistaPaid.toFixed(2)}</p>
            </div>
            <div className="flex-1 flex flex-col gap-0.5">
              <p style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-12)', lineHeight: '16px', fontWeight: 600 }}>Mensalista Pendente</p>
              <p style={{ color: mensalistaPending > 0 ? 'var(--color-danger)' : 'var(--color-fg-accent)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)', fontWeight: 600 }}>R$ {mensalistaPending.toFixed(2)}</p>
            </div>
          </div>
          <div className="flex gap-5">
            <div className="flex-1 flex flex-col gap-0.5">
              <p style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-12)', lineHeight: '16px', fontWeight: 600 }}>Avulso Recebido</p>
              <p style={{ color: 'var(--color-fg-accent)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)', fontWeight: 600 }}>R$ {avulsoPaid.toFixed(2)}</p>
            </div>
            <div className="flex-1 flex flex-col gap-0.5">
              <p style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-12)', lineHeight: '16px', fontWeight: 600 }}>Avulso Pendente</p>
              <p style={{ color: avulsoPending > 0 ? 'var(--color-danger)' : 'var(--color-fg-accent)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)', fontWeight: 600 }}>R$ {avulsoPending.toFixed(2)}</p>
            </div>
          </div>
        </div>

        <div style={{ height: 1, background: 'var(--color-border)' }} />

        {/* ATENÇÃO JOVENS — centralizado */}
        <div className="flex flex-col gap-6 pb-2">
          <p className="font-medium text-center" style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-14)' }}>ATENÇÃO JOVENS</p>
          <div className="flex gap-6">
            {/* Mensalista */}
            <div className="flex-1 flex flex-col items-center gap-2 text-center">
              <div className="flex items-center gap-1.5 justify-center">
                <p style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-14)', fontWeight: 500 }}>Valor do Mensalista:</p>
                {isAdmin && editingField !== 'mensalista' && <button onClick={() => openEdit('mensalista', mensalistaValue)}><PencilSimple size={13} color="var(--color-fg-secondary)" /></button>}
                {isAdmin && editingField === 'mensalista' && <button onClick={() => setEditingField(null)}><X size={13} color="var(--color-fg-secondary)" /></button>}
              </div>
              {editingField === 'mensalista' ? (
                <div className="flex gap-2 justify-center">
                  <input type="number" value={editValue} onChange={e => setEditValue(e.target.value)}
                    className="outline-none rounded-full px-3 py-1.5"
                    style={{ background: 'var(--color-surface-secondary)', border: '1.5px solid var(--color-border)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)', color: 'var(--color-fg-primary)', width: 90 }} />
                  <button onClick={() => saveField.mutate()} disabled={saveField.isPending}
                    className="px-3 rounded-full font-medium text-sm disabled:opacity-40"
                    style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-fg)' }}>OK</button>
                </div>
              ) : (
                <p style={{ color: 'var(--color-fg-accent)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-24)', lineHeight: '28px', fontWeight: 600 }}>R$ {mensalistaValue.toFixed(2)}</p>
              )}
            </div>
            {/* Avulso */}
            <div className="flex-1 flex flex-col items-center gap-2 text-center">
              <div className="flex items-center gap-1.5 justify-center">
                <p style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-14)', fontWeight: 500 }}>Valor do Avulso:</p>
                {isAdmin && editingField !== 'avulso' && <button onClick={() => openEdit('avulso', avulsoValue)}><PencilSimple size={13} color="var(--color-fg-secondary)" /></button>}
                {isAdmin && editingField === 'avulso' && <button onClick={() => setEditingField(null)}><X size={13} color="var(--color-fg-secondary)" /></button>}
              </div>
              {editingField === 'avulso' ? (
                <div className="flex gap-2 justify-center">
                  <input type="number" value={editValue} onChange={e => setEditValue(e.target.value)}
                    className="outline-none rounded-full px-3 py-1.5"
                    style={{ background: 'var(--color-surface-secondary)', border: '1.5px solid var(--color-border)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)', color: 'var(--color-fg-primary)', width: 90 }} />
                  <button onClick={() => saveField.mutate()} disabled={saveField.isPending}
                    className="px-3 rounded-full font-medium text-sm disabled:opacity-40"
                    style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-fg)' }}>OK</button>
                </div>
              ) : (
                <p style={{ color: 'var(--color-fg-accent)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-24)', lineHeight: '28px', fontWeight: 600 }}>R$ {avulsoValue.toFixed(2)}</p>
              )}
            </div>
          </div>

          {/* ── SEÇÃO DE PAGAMENTO UNIFICADA ──────────────────────────────
               Cobre: pagamento próprio (jogo ou mensalidade) + avulsos temporários.
               Estados independentes: own (hasRequested/isApproved) e temp (hasPendingTempAvulsoRequest).
               Quando ambos estão pendentes: mostra breakdown + total + um único "Já Paguei".
               ──────────────────────────────────────────────────────────────── */}

          {/* Estado: aguardando aprovação (próprio submetido; temp pode estar submetido ou ainda pendente) */}
          {hasRequested && (
            <div className="flex flex-col gap-2">
              <div className="w-full py-3 flex items-center justify-center gap-2 rounded-full" style={{ background: 'var(--color-surface-primary)', border: '1px solid var(--color-border)' }}>
                <p style={{ color: 'var(--color-fg-secondary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-14)' }}>Aguardando aprovação do admin</p>
              </div>
              {/* Se temp ainda não foi submetido (ex: adicionou após já ter enviado o próprio) */}
              {hasTempAvulsoPending && (
                <div className="flex gap-3">
                  <button onClick={handleCopyPix}
                    className="flex-1 py-4 flex items-center justify-center gap-2 font-medium transition-all active:scale-95"
                    style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-fg)', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)' }}>
                    {pixCopied ? <Check size={18} /> : <Copy size={18} />}
                    {pixCopied ? 'Copiado!' : 'Copiar PIX'}
                  </button>
                  <button onClick={() => submitPaymentRequest.mutate()} disabled={submitPaymentRequest.isPending}
                    className="flex-1 py-4 flex items-center justify-center gap-2 font-medium transition-all active:scale-95 disabled:opacity-40"
                    style={{ background: 'var(--btn-secondary-bg)', color: 'var(--btn-secondary-fg)', border: '1px solid var(--btn-secondary-border)', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)' }}>
                    {submitPaymentRequest.isPending ? '...' : `Paguei Avulso Temp (+R$ ${tempTotalAmount.toFixed(2)})`}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Estado: pagamento próprio aprovado (mensalistas) */}
          {!hasRequested && isApproved && (
            <div className="flex flex-col gap-2">
              <div className="w-full py-3 flex items-center justify-center gap-2 rounded-full" style={{ background: '#e6f4ea' }}>
                <CheckCircle size={18} weight="fill" color="#089527" />
                <p style={{ color: '#089527', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-14)', fontWeight: 500 }}>Pagamento aprovado!</p>
              </div>
              {/* Temp aguardando */}
              {hasPendingTempAvulsoRequest && (
                <div className="w-full py-3 flex items-center justify-center gap-2 rounded-full" style={{ background: 'var(--color-surface-primary)', border: '1px solid var(--color-border)' }}>
                  <p style={{ color: 'var(--color-fg-secondary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-14)' }}>Avulso temp: aguardando aprovação</p>
                </div>
              )}
              {/* Temp ainda não submetido */}
              {hasTempAvulsoPending && !hasPendingTempAvulsoRequest && (
                <div className="flex gap-3">
                  <button onClick={handleCopyPix}
                    className="flex-1 py-4 flex items-center justify-center gap-2 font-medium transition-all active:scale-95"
                    style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-fg)', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)' }}>
                    {pixCopied ? <Check size={18} /> : <Copy size={18} />}
                    {pixCopied ? 'Copiado!' : 'Copiar PIX'}
                  </button>
                  <button onClick={() => submitPaymentRequest.mutate()} disabled={submitPaymentRequest.isPending}
                    className="flex-1 py-4 flex items-center justify-center gap-2 font-medium transition-all active:scale-95 disabled:opacity-40"
                    style={{ background: 'var(--btn-secondary-bg)', color: 'var(--btn-secondary-fg)', border: '1px solid var(--btn-secondary-border)', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)' }}>
                    {submitPaymentRequest.isPending ? '...' : `Paguei Avulso Temp (R$ ${tempTotalAmount.toFixed(2)})`}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Estado: ação necessária — ambos (ou apenas o próprio) ainda não submetidos */}
          {(!isAvulso || avulsoNeedsPay) && !hasRequested && !isApproved && !hasPendingTempAvulsoRequest && (
            <div className="flex flex-col gap-3">
              {/* Breakdown quando tem temp avulso pendente junto */}
              {hasTempAvulsoPending && (
                <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
                  <div className="flex justify-between px-4 py-2.5" style={{ background: 'var(--color-surface-primary)' }}>
                    <p style={{ color: 'var(--color-fg-secondary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-13)' }}>
                      {isAvulso ? 'Entrada (jogo)' : 'Mensalidade'}
                    </p>
                    <p style={{ color: 'var(--color-fg-secondary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-13)' }}>
                      R$ {ownAmount.toFixed(2)}
                    </p>
                  </div>
                  {unpaidTempAvulsos.map((t: any) => (
                    <div key={t.id} className="flex justify-between px-4 py-2.5" style={{ background: 'var(--color-surface-primary)', borderTop: '1px solid var(--color-border)' }}>
                      <p style={{ color: 'var(--color-fg-secondary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-13)' }}>
                        Avulso: {t.name}
                      </p>
                      <p style={{ color: 'var(--color-fg-secondary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-13)' }}>
                        R$ {avulsoValue.toFixed(2)}
                      </p>
                    </div>
                  ))}
                  <div className="flex justify-between px-4 py-2.5" style={{ borderTop: '1px solid var(--color-border)', background: 'var(--color-surface-secondary)' }}>
                    <p style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-14)', fontWeight: 600 }}>Total</p>
                    <p style={{ color: 'var(--color-danger)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-14)', fontWeight: 700 }}>
                      R$ {(ownAmount + tempTotalAmount).toFixed(2)}
                    </p>
                  </div>
                </div>
              )}
              <div className="flex gap-3">
                <button onClick={handleCopyPix}
                  className="flex-1 py-4 flex items-center justify-center gap-2 font-medium transition-all active:scale-95"
                  style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-fg)', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)' }}>
                  {pixCopied ? <Check size={18} /> : <Copy size={18} />}
                  {pixCopied ? 'Copiado!' : 'Copiar PIX'}
                </button>
                <button onClick={() => submitPaymentRequest.mutate()} disabled={submitPaymentRequest.isPending}
                  className="flex-1 py-4 flex items-center justify-center gap-2 font-medium transition-all active:scale-95 disabled:opacity-40"
                  style={{ background: 'var(--btn-secondary-bg)', color: 'var(--btn-secondary-fg)', border: '1px solid var(--btn-secondary-border)', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)' }}>
                  {submitPaymentRequest.isPending ? '...' : 'Já Paguei'}
                </button>
              </div>
            </div>
          )}

          {/* Avulso temp aguardando (sem pagamento próprio pendente — ex: avulso aprovado, temp ainda em aberto) */}
          {hasPendingTempAvulsoRequest && !hasRequested && !isApproved && (
            <div className="w-full py-3 flex items-center justify-center gap-2 rounded-full" style={{ background: 'var(--color-surface-primary)', border: '1px solid var(--color-border)' }}>
              <p style={{ color: 'var(--color-fg-secondary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-14)' }}>Avulso temp: aguardando aprovação</p>
            </div>
          )}
        </div>

        {(jogoPayments.length > 0 || Object.keys(byMonth).length > 0) && <div style={{ height: 1, background: 'var(--color-border)' }} />}

        {(jogoPayments.length > 0 || (isAdmin && allTempAvulsos.length > 0)) && !playerData?.player_type?.includes('avulso') && (
          <section>
            <p className="font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-fg-secondary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-12)' }}>Por jogo — avulsos</p>
            <div className="flex flex-col gap-2">
              {jogoPayments.map(p => <PaymentRow key={p.id} payment={p} onToggle={() => setSelectedPayment(p)} isAdmin={isAdmin} />)}
              {isAdmin && allTempAvulsos.map((t: any) => (
                <div key={t.id} className="w-full flex items-center gap-3 p-4 rounded-3xl"
                  style={{ background: 'var(--color-surface-primary)' }}>
                  <Circle size={22} color="var(--color-fg-secondary)" />
                  <div className="flex-1 text-left">
                    <p className="font-medium" style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)' }}>
                      {t.addedByName}
                    </p>
                    <p style={{ color: 'var(--color-fg-secondary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-12)' }}>
                      Avulso temp: {t.name}
                    </p>
                  </div>
                  <p className="font-semibold" style={{ color: 'var(--color-danger)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)' }}>
                    R$ {avulsoValue.toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {playerData?.player_type !== 'avulso' && Object.entries(byMonth).map(([monthKey, monthPayments]) => {
          const [year, m] = monthKey.split('-')
          const label = format(new Date(Number(year), Number(m) - 1, 1), 'MMMM yyyy', { locale: ptBR })
          return (
            <section key={monthKey}>
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold uppercase tracking-wider capitalize" style={{ color: 'var(--color-fg-secondary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-12)' }}>{label}</p>
                <p style={{ color: 'var(--color-fg-secondary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-12)' }}>{monthPayments.filter(p => p.paid).length}/{monthPayments.length}</p>
              </div>
              <div className="flex flex-col gap-2">
                {monthPayments.map(p => <PaymentRow key={p.id} payment={p} onToggle={() => setSelectedPayment(p)} isAdmin={isAdmin} />)}
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

      {/* Bottom sheet — excluir pagamento (admin only) */}
      {isAdmin && selectedPayment && (
        <>
          <div className="fixed inset-0 z-60" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={() => setSelectedPayment(null)} />
          <div className="fixed bottom-0 left-0 right-0 z-70 rounded-t-3xl px-6 pt-4 pb-10 flex flex-col gap-3"
            style={{ background: 'var(--color-bg)' }}>
            <div className="w-10 h-1 rounded-full mx-auto mb-2" style={{ background: 'var(--color-border)' }} />
            <p className="font-semibold" style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)' }}>
              {(selectedPayment.profile as any)?.name || 'Jogador'}
            </p>
            <p style={{ color: 'var(--color-fg-secondary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-14)' }}>
              {selectedPayment.type === 'mensalidade' ? 'Mensalidade' : 'Avulso'} · R$ {selectedPayment.amount} · {selectedPayment.paid ? 'Pago' : 'Pendente'}
            </p>
            <button
              onClick={() => deletePayment.mutate(selectedPayment)}
              disabled={deletePayment.isPending}
              className="w-full py-4 font-medium rounded-full transition-all active:scale-95 disabled:opacity-40 mt-2"
              style={{ background: 'var(--color-danger)', color: '#fff', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)' }}>
              {deletePayment.isPending ? 'Removendo...' : 'Excluir Pagamento'}
            </button>
            <button
              onClick={() => setSelectedPayment(null)}
              className="w-full py-4 font-medium rounded-full transition-all active:scale-95"
              style={{ background: 'var(--color-surface-primary)', color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)' }}>
              Cancelar
            </button>
          </div>
        </>
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
      {payment.paid ? <CheckCircle size={22} weight="fill" color="var(--color-success)" /> : <Circle size={22} color="var(--color-fg-secondary)" />}
      <div className="flex-1 text-left">
        <p className="font-medium" style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)' }}>{name}</p>
        <p style={{ color: 'var(--color-fg-secondary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-12)' }}>
          {payment.paid && payment.paid_at ? `Pago em ${format(new Date(payment.paid_at), 'd/MM/yyyy')}` : 'Pendente'}
        </p>
      </div>
      <p className="font-semibold" style={{ color: payment.paid ? 'var(--color-success)' : 'var(--color-danger)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)' }}>R$ {payment.amount}</p>
    </button>
  )
}

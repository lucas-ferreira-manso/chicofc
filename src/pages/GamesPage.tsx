import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { collection, getDocs, query, where, doc, getDoc, writeBatch, addDoc, deleteDoc, orderBy, updateDoc, arrayRemove } from 'firebase/firestore'
import { getAuth, getIdToken } from 'firebase/auth'
import { db } from '../lib/firebase'
import { useAuthStore } from '../store/authStore'
import { format, isAfter, nextWednesday, isWednesday, startOfDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Crown, BellRinging, CheckCircle, ShareNetwork, X, BellSimple, HandPalm } from '@phosphor-icons/react'
import { useRef } from 'react'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import type { Attendance } from '../types'
import Header from '../components/layout/Header'
import { useLockBodyScroll } from '../lib/useLockBodyScroll'

const MAX_PLAYERS = 16
const SERVER_URL = 'https://chicofc-server.onrender.com'

function getNextWednesday(): Date {
  const now = new Date()
  const today = startOfDay(now)
  if (isWednesday(today)) {
    // Após 23h da quarta, avança para a próxima quarta (reset da página)
    const resetTime = new Date(today)
    resetTime.setHours(23, 0, 0, 0)
    if (isAfter(now, resetTime)) return nextWednesday(today)
    return today
  }
  return nextWednesday(today)
}

function getGameId(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

function getPriorityDeadline(gameDate: Date): Date {
  const tuesday = new Date(gameDate)
  tuesday.setDate(gameDate.getDate() - 1)
  tuesday.setHours(13, 0, 0, 0)
  return tuesday
}

function isPriorityWindowOpen(gameDate: Date): boolean {
  return !isAfter(new Date(), getPriorityDeadline(gameDate))
}

function getInitials(name: string): string {
  return name
    .trim()
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(n => n[0].toUpperCase())
    .join('')
}

function Avatar({ name, photoURL, bgSelected = false }: {
  name: string
  photoURL?: string
  bgSelected?: boolean
}) {
  const initials = getInitials(name)
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 overflow-hidden"
      style={{ background: photoURL ? 'transparent' : bgSelected ? 'var(--color-fg-accent-light)' : 'var(--color-avatar-bg)' }}>
      {photoURL ? (
        <img src={photoURL} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <span style={{
          color: bgSelected ? 'white' : 'var(--color-avatar-fg)',
          fontFamily: 'var(--font-primary)',
          fontSize: 14,
          fontWeight: 500
        }}>
          {initials}
        </span>
      )}
    </div>
  )
}

async function fetchLineup(gameId: string): Promise<{ blue: string[]; black: string[] }> {
  const snap = await getDoc(doc(db, 'lineups', gameId))
  if (!snap.exists()) return { blue: [], black: [] }
  return snap.data() as { blue: string[]; black: string[] }
}

interface TempAvulso {
  id: string
  name: string
  addedBy: string
  addedByName: string
  gameId: string
  createdAt: string
}

function getTuesdayAt16h(gameDate: Date): Date {
  const tuesday = new Date(gameDate)
  tuesday.setDate(gameDate.getDate() - 1)
  tuesday.setHours(16, 0, 0, 0)
  return tuesday
}

function getWednesdayAt21h(gameDate: Date): Date {
  const wednesday = new Date(gameDate)
  wednesday.setHours(21, 0, 0, 0)
  return wednesday
}

// Avulso temporário fica disponível 20min a mais que o resto da lista —
// é o recurso pra repor alguém em cima da hora, então fecha mais perto do jogo (21h30)
function getWednesdayAt2120h(gameDate: Date): Date {
  const wednesday = new Date(gameDate)
  wednesday.setHours(21, 20, 0, 0)
  return wednesday
}

function shouldShowAvulsoButton(gameDate: Date, totalConfirmed: number): boolean {
  const now = new Date()
  return (
    isAfter(now, getTuesdayAt16h(gameDate)) &&
    !isAfter(now, getWednesdayAt2120h(gameDate)) &&
    totalConfirmed < 14
  )
}

async function fetchTempAvulsos(gameId: string): Promise<TempAvulso[]> {
  const q = query(collection(db, 'avulsos_temp'), where('gameId', '==', gameId))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as TempAvulso))
}

// Avisa todos os admins quando a escalação precisa ser revista (jogador confirmou
// ou avulso temp entrou depois que os times já foram salvos) — grava no Notification
// Center (visível mesmo sem push) e dispara push em paralelo
async function notifyAdminsLineupChanged(message: string) {
  try {
    const adminSnap = await getDocs(query(collection(db, 'players'), where('role', '==', 'admin')))

    await Promise.all(adminSnap.docs.map(adminDoc =>
      addDoc(collection(db, 'notifications'), {
        user_id: adminDoc.id,
        title: 'Escalação precisa de revisão',
        message,
        type: 'message',
        read: false,
        created_at: new Date().toISOString()
      }).catch(() => {})
    ))

    const authInstance = getAuth()
    const currentUser = authInstance.currentUser
    if (currentUser) {
      const token = await getIdToken(currentUser)
      await Promise.all(adminSnap.docs.map(adminDoc =>
        fetch(`${SERVER_URL}/notify-cobranca`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ userId: adminDoc.id, message })
        }).catch(() => {})
      ))
    }
  } catch { /* notificação de admin não bloqueia a ação */ }
}

async function fetchAllPlayers(): Promise<{ id: string; name: string; player_type: string; photoURL?: string }[]> {
  const snap = await getDocs(query(collection(db, 'players'), where('active', '==', true)))
  return snap.docs.map(d => ({ id: d.id, name: d.data().name ?? '', player_type: d.data().player_type ?? 'avulso', photoURL: d.data().photoURL }))
}

async function fetchAttendances(gameId: string): Promise<Attendance[]> {
  const q = query(collection(db, 'attendances'), where('game_id', '==', gameId))
  const snap = await getDocs(q)
  return Promise.all(snap.docs.map(async d => {
    const data = d.data()
    const profileSnap = await getDoc(doc(db, 'players', data.user_id))
    return {
      id: d.id,
      ...data,
      profile: profileSnap.exists() ? { id: profileSnap.id, ...profileSnap.data() } : undefined
    } as Attendance
  }))
}

async function fetchUnreadCount(userId: string, isAdmin: boolean): Promise<number> {
  const notifQuery = query(
    collection(db, 'notifications'),
    where('user_id', '==', userId)
  )
  const notifSnap = await getDocs(notifQuery)
  let count = notifSnap.docs.filter(d => d.data().read === false).length
  if (isAdmin) {
    const prQuery = query(collection(db, 'payment_requests'), where('status', '==', 'pending'))
    const prSnap = await getDocs(prQuery)
    count += prSnap.size
  }
  return count
}

export default function GamesPage() {
  const user = useAuthStore(s => s.user)
  const isAdmin = user?.role === 'admin'
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [activeTeam, setActiveTeam] = useState<'blue' | 'black'>('blue')
  const [sharing, setSharing] = useState(false)
  const [showAvulsoSheet, setShowAvulsoSheet] = useState(false)
  const [avulsoName, setAvulsoName] = useState('')
  const [selectedTempAvulso, setSelectedTempAvulso] = useState<TempAvulso | null>(null)
  const [confirmRemoveAttendance, setConfirmRemoveAttendance] = useState<Attendance | null>(null)
  const [showDeclineSheet, setShowDeclineSheet] = useState(false)
  useLockBodyScroll(!!(showAvulsoSheet || selectedTempAvulso || confirmRemoveAttendance || showDeclineSheet))
  const shareCardRef = useRef<HTMLDivElement>(null)

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['notifications-unread', user?.id],
    queryFn: () => fetchUnreadCount(user!.id, isAdmin),
    enabled: !!user?.id,
    refetchInterval: 15000
  })

  const handleShare = async () => {
    setSharing(true)
    try {
      const scale = 2
      const W = 390

      // Calcula altura dinamicamente
      const rowH = 40
      const teamH = (ids: string[]) => 32 + ids.length * rowH + 16
      const totalH = 72 + teamH(lineup.blue) + teamH(lineup.black) + 32

      const canvas = document.createElement('canvas')
      canvas.width = W * scale
      canvas.height = totalH * scale
      const ctx = canvas.getContext('2d')!
      ctx.scale(scale, scale)

      // Fundo
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, W, totalH)

      // Rounded rect helper
      const rRect = (x: number, y: number, w: number, h: number, r: number) => {
        ctx.beginPath()
        ctx.moveTo(x + r, y)
        ctx.lineTo(x + w - r, y)
        ctx.quadraticCurveTo(x + w, y, x + w, y + r)
        ctx.lineTo(x + w, y + h - r)
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
        ctx.lineTo(x + r, y + h)
        ctx.quadraticCurveTo(x, y + h, x, y + h - r)
        ctx.lineTo(x, y + r)
        ctx.quadraticCurveTo(x, y, x + r, y)
        ctx.closePath()
      }

      // Header
      ctx.font = 'bold 18px system-ui, -apple-system, sans-serif'
      ctx.fillStyle = '#1a1a1a'
      ctx.fillText('ChicoFC ⚽', 24, 42)
      ctx.font = '13px system-ui, -apple-system, sans-serif'
      ctx.fillStyle = '#8e8e93'
      ctx.fillText(`${gameDateStr} | Quarta-feira, 21:30`, 24, 62)

      let y = 82
      for (const team of ['blue', 'black'] as const) {
        const ids = team === 'blue' ? lineup.blue : lineup.black
        const label = team === 'blue' ? '🔵 Time Azul' : '⚫ Time Preto'

        ctx.font = 'bold 13px system-ui, -apple-system, sans-serif'
        ctx.fillStyle = '#1a1a1a'
        ctx.fillText(label, 24, y + 16)
        y += 32

        ids.forEach((uid, i) => {
          const att = confirmed.find(a => a.user_id === uid)
          const tempAvulso = tempAvulsos.find(t => `temp_${t.id}` === uid)
          const name = (att as any)?.profile?.name || (att as any)?.profile?.email || tempAvulso?.name || uid

          ctx.fillStyle = '#f8f8f8'
          rRect(24, y, W - 48, 32, 10)
          ctx.fill()

          ctx.font = '12px system-ui, -apple-system, sans-serif'
          ctx.fillStyle = '#8e8e93'
          ctx.fillText(`${i + 1}`, 36, y + 21)

          ctx.font = '500 14px system-ui, -apple-system, sans-serif'
          ctx.fillStyle = '#1a1a1a'
          ctx.fillText(name, 58, y + 21)

          y += rowH
        })
        y += 16
      }

      // Footer
      ctx.font = '11px system-ui, -apple-system, sans-serif'
      ctx.fillStyle = '#c7c7cc'
      ctx.textAlign = 'center'
      ctx.fillText('chicofc.vercel.app', W / 2, totalH - 12)

      canvas.toBlob(async (blob) => {
        setSharing(false)
        if (!blob) { toast.error('Erro ao gerar imagem'); return }
        const file = new File([blob], 'escalacao-chicofc.png', { type: 'image/png' })
        try {
          if (navigator.share && navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title: 'Escalação ChicoFC ⚽' })
          } else {
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url; a.download = 'escalacao-chicofc.png'; a.click()
            URL.revokeObjectURL(url)
            toast.success('Imagem salva!')
          }
        } catch { /* usuário cancelou o share */ }
      }, 'image/png')

    } catch (e) {
      console.error(e)
      toast.error('Erro ao gerar imagem')
      setSharing(false)
    }
  }

  const gameDate = getNextWednesday()
  const gameId = getGameId(gameDate)
  const priorityOpen = isPriorityWindowOpen(gameDate)
  const deadline = getPriorityDeadline(gameDate)
  const deadlineStr = format(deadline, "EEE dd/MM 'às' HH'h'mm", { locale: ptBR })
  const gameDateStr = format(gameDate, 'dd/MM')

  const { data: attendances = [], isLoading } = useQuery({
    queryKey: ['attendances', gameId],
    queryFn: () => fetchAttendances(gameId)
  })

  const { data: tempAvulsos = [] } = useQuery({
    queryKey: ['temp-avulsos', gameId],
    queryFn: () => fetchTempAvulsos(gameId),
    refetchInterval: 15000
  })

  const { data: allPlayers = [] } = useQuery({
    queryKey: ['all-players'],
    queryFn: fetchAllPlayers,
    staleTime: 1000 * 60 * 5
  })

  const myAttendance = attendances.find(a => a.user_id === user?.id)
  const confirmed = attendances.filter(a => a.status === 'confirmed')
  const waitlist = attendances.filter(a => a.status === 'waitlist')
  const declined = attendances.filter(a => a.status === 'declined')
  const confirmedMensalistas = confirmed.filter(a => a.player_type === 'mensalista')
  const confirmedAvulsos = confirmed.filter(a => a.player_type === 'avulso')
  const respondedIds = new Set(attendances.map(a => a.user_id))
  const toConfirm = allPlayers.filter(p => !respondedIds.has(p.id))
  const totalConfirmed = confirmed.length + waitlist.length + tempAvulsos.length
  const isFull = totalConfirmed >= MAX_PLAYERS
  const amConfirmed = myAttendance?.status === 'confirmed'
  const amInWaitlist = myAttendance?.status === 'waitlist'
  const amDeclined = myAttendance?.status === 'declined'
  const avulsoWindowOpen = shouldShowAvulsoButton(gameDate, totalConfirmed)
  const showAvulsoBtn = amConfirmed && avulsoWindowOpen

  const closeTime = getWednesdayAt21h(gameDate)
  const listaClosed = isAfter(new Date(), closeTime)

  const escalacaoClosed = isAfter(new Date(), getWednesdayAt21h(gameDate))

  // "Escalar Times" só aparece: quarta-feira, após 16h, mínimo 12 confirmados, antes das 21h
  const escalacaoOpenTime = new Date(gameDate)
  escalacaoOpenTime.setHours(16, 0, 0, 0)
  const showEscalarBtn = isWednesday(startOfDay(new Date()))
    && isAfter(new Date(), escalacaoOpenTime)
    && !escalacaoClosed
    && totalConfirmed >= 12

  const { data: lineup = { blue: [], black: [] } } = useQuery({
    queryKey: ['lineup', gameId],
    queryFn: () => fetchLineup(gameId),
    refetchInterval: 10000
  })

  const hasLineup = lineup.blue.length >= 6 && lineup.black.length >= 6
  const myTeam = lineup.blue.includes(user?.id ?? '') ? 'blue' : lineup.black.includes(user?.id ?? '') ? 'black' : null

  // Confirmados (e avulsos temp) que ainda não estão em nenhum dos dois times —
  // ex: confirmaram depois que a escalação já foi salva
  const lineupIds = new Set([...lineup.blue, ...lineup.black])
  const unassignedConfirmed = confirmed.filter(a => !lineupIds.has(a.user_id))
  const unassignedTempAvulsos = tempAvulsos.filter(t => !lineupIds.has(`temp_${t.id}`))

  const handleConfirm = useMutation({
    mutationFn: async () => {
      const batch = writeBatch(db)
      let shouldNotifyAvulso = false

      // Busca dados frescos do Firestore — evita usar cache stale que causa attendances duplicadas
      // (cenário: resposta demorou, mutation pareceu falhar, usuário tocou de novo)
      const [freshPlayerSnap, freshAttSnap] = await Promise.all([
        getDoc(doc(db, 'players', user!.id)),
        getDocs(query(collection(db, 'attendances'), where('game_id', '==', gameId), where('user_id', '==', user!.id)))
      ])
      const playerType: string = freshPlayerSnap.exists() ? (freshPlayerSnap.data().player_type ?? 'avulso') : 'avulso'
      const freshAttendance = freshAttSnap.empty ? null : { id: freshAttSnap.docs[0].id, ...freshAttSnap.docs[0].data() } as any

      // Idempotência: se já está confirmado, não faz nada
      if (freshAttendance?.status === 'confirmed') return

      if (freshAttendance) {
        // Caso especial: player mudou de tipo (era avulso, agora é mensalista)
        // → descarta attendance antiga + pagamento orphaned, recria como mensalista
        if (playerType === 'mensalista' && freshAttendance.player_type === 'avulso') {
          batch.delete(doc(db, 'attendances', freshAttendance.id))
          const orphanedPay = await getDocs(query(
            collection(db, 'payments'),
            where('user_id', '==', user!.id),
            where('game_id', '==', gameId),
            where('paid', '==', false)
          ))
          orphanedPay.docs.forEach(d => batch.delete(d.ref))
          batch.set(doc(collection(db, 'attendances')), {
            game_id: gameId, user_id: user!.id, player_type: 'mensalista',
            status: isFull ? 'waitlist' : 'confirmed',
            confirmed_at: new Date().toISOString()
          })
        } else {
          // Movendo da espera / declined para confirmado
          batch.update(doc(db, 'attendances', freshAttendance.id), { status: 'confirmed' })
          if (playerType === 'avulso' && freshAttendance.status === 'waitlist' && !priorityOpen) {
            shouldNotifyAvulso = true
          }
        }
      } else {
        // Sem attendance prévia — cria nova
        const status: 'confirmed' | 'waitlist' = (isFull || playerType === 'avulso') ? 'waitlist' : 'confirmed'
        batch.set(doc(collection(db, 'attendances')), {
          game_id: gameId, user_id: user!.id, player_type: playerType,
          status, confirmed_at: new Date().toISOString()
        })
        if (playerType === 'avulso') {
          batch.set(doc(collection(db, 'payments')), {
            user_id: user!.id, amount: 22, type: 'jogo',
            game_id: gameId, month: gameId, paid: false, created_at: new Date().toISOString()
          })
        }
      }
      await batch.commit()

      // Notifica avulso confirmado para lembrar de pagar
      if (shouldNotifyAvulso) {
        try {
          // Escreve no Notification Center
          await addDoc(collection(db, 'notifications'), {
            user_id: user!.id,
            title: 'Lembrete de pagamento',
            message: 'Você confirmou presença! Não esqueça de pagar o jogo na Caixinha.',
            type: 'message',
            read: false,
            created_at: new Date().toISOString()
          })
          // Push notification
          const authInstance = getAuth()
          const currentUser = authInstance.currentUser
          if (currentUser) {
            const token = await getIdToken(currentUser)
            await fetch(`${SERVER_URL}/notify-cobranca`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({
                userId: user!.id,
                message: 'Você confirmou presença! Não esqueça de pagar o jogo. Acesse a Caixinha para efetuar o pagamento.'
              })
            })
          }
        } catch { /* falha na notificação não bloqueia a confirmação */ }
      }

      // Notifica admins se times já escalados → novo jogador confirmou
      if (hasLineup) {
        const playerType = user!.player_type ?? 'avulso'
        const playerName = user!.name || user!.email || 'Jogador'
        await notifyAdminsLineupChanged(`Novo jogador confirmado: ${playerName} (${playerType}). Rever escalação dos times.`)
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendances', gameId] })
      const playerType = user!.player_type ?? 'avulso'
      if (isFull || playerType === 'avulso') {
        toast('Na lista de espera ⏳')
      } else {
        toast.success('Bora jogar! 🙌')
      }
    },
    onError: () => toast.error('Erro ao confirmar presença')
  })

  const handleDecline = useMutation({
    mutationFn: async () => {
      // Busca pagamento não pago do avulso para deletar ao sair
      let unpaidPaymentId: string | null = null
      if (myAttendance && user?.player_type === 'avulso') {
        const paySnap = await getDocs(query(
          collection(db, 'payments'),
          where('user_id', '==', user!.id),
          where('game_id', '==', gameId),
          where('paid', '==', false)
        ))
        if (!paySnap.empty) unpaidPaymentId = paySnap.docs[0].id
      }

      const batch = writeBatch(db)
      if (myAttendance) {
        // Promove próximo da fila se o que saiu estava confirmado + reseta escalação
        if (myAttendance.status === 'confirmed' && waitlist.length > 0) {
          const next = waitlist[0]
          batch.update(doc(db, 'attendances', next.id), { status: 'confirmed' })
        }
        // Se estava confirmado e está escalado, remove do time (blue ou black)
        if (myAttendance.status === 'confirmed' && hasLineup) {
          const lineupRef = doc(db, 'lineups', gameId)
          const inBlue = lineup.blue.includes(user!.id)
          const inBlack = lineup.black.includes(user!.id)
          if (inBlue || inBlack) {
            await updateDoc(lineupRef, {
              ...(inBlue && { blue: arrayRemove(user!.id) }),
              ...(inBlack && { black: arrayRemove(user!.id) }),
            })
          }
        }
        batch.update(doc(db, 'attendances', myAttendance.id), { status: 'declined' })
        // Remove pagamento pendente ao sair da pelada
        if (unpaidPaymentId) {
          batch.delete(doc(db, 'payments', unpaidPaymentId))
        }
      } else {
        const attRef = doc(collection(db, 'attendances'))
        batch.set(attRef, {
          game_id: gameId,
          user_id: user!.id,
          player_type: user!.player_type ?? 'avulso',
          status: 'declined',
          confirmed_at: new Date().toISOString()
        })
      }
      await batch.commit()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendances', gameId] })
      qc.invalidateQueries({ queryKey: ['lineup', gameId] })
      toast('Muié não deixou 😅')
    },
    onError: () => toast.error('Erro ao registrar ausência')
  })

  const addAvulso = useMutation({
    mutationFn: async () => {
      const userName = (user as any)?.name || (user as any)?.email || 'Usuário'
      const name = avulsoName.trim()
      await addDoc(collection(db, 'avulsos_temp'), {
        name,
        addedBy: user!.id,
        addedByName: userName,
        gameId,
        createdAt: new Date().toISOString()
      })

      // Times já escalados → avisa admins que precisam incluir o avulso em um time
      if (hasLineup) {
        await notifyAdminsLineupChanged(`Novo avulso temporário adicionado: ${name}. Rever escalação dos times.`)
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['temp-avulsos', gameId] })
      setAvulsoName('')
      setShowAvulsoSheet(false)
      toast.success('Avulso temporário adicionado!')
    },
    onError: () => toast.error('Erro ao adicionar avulso')
  })

  const removeAvulso = useMutation({
    mutationFn: async (id: string) => {
      await deleteDoc(doc(db, 'avulsos_temp', id))
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['temp-avulsos', gameId] })
      setSelectedTempAvulso(null)
      toast.success('Avulso removido.')
    },
    onError: () => toast.error('Erro ao remover avulso')
  })

  const adminRemovePlayer = useMutation({
    mutationFn: async (attendance: Attendance) => {
      const batch = writeBatch(db)
      // Remove pagamento pendente se avulso
      if (attendance.player_type === 'avulso') {
        const paySnap = await getDocs(query(
          collection(db, 'payments'),
          where('user_id', '==', attendance.user_id),
          where('game_id', '==', gameId),
          where('paid', '==', false)
        ))
        if (!paySnap.empty) batch.delete(doc(db, 'payments', paySnap.docs[0].id))
      }
      // Promove próximo da waitlist
      if (waitlist.length > 0) {
        batch.update(doc(db, 'attendances', waitlist[0].id), { status: 'confirmed' })
      }
      // Muda status para declined
      batch.update(doc(db, 'attendances', attendance.id), { status: 'declined' })
      await batch.commit()
      // Remove cirurgicamente do lineup (fora do batch pois usa arrayRemove)
      const inBlue = lineup.blue.includes(attendance.user_id)
      const inBlack = lineup.black.includes(attendance.user_id)
      if (inBlue || inBlack) {
        await updateDoc(doc(db, 'lineups', gameId), {
          ...(inBlue && { blue: arrayRemove(attendance.user_id) }),
          ...(inBlack && { black: arrayRemove(attendance.user_id) }),
        })
      }
    },
    onSuccess: (_, attendance) => {
      qc.invalidateQueries({ queryKey: ['attendances', gameId] })
      qc.invalidateQueries({ queryKey: ['lineup', gameId] })
      setConfirmRemoveAttendance(null)
      const promoted = waitlist[0]
      const promotedName = (promoted?.profile as any)?.name || (promoted?.profile as any)?.email
      toast.success(promotedName
        ? `Jogador removido. ${promotedName} promovido da espera!`
        : 'Jogador removido da lista.')
    },
    onError: () => toast.error('Erro ao remover jogador')
  })

  // Migração: cria payment para avulsos na espera que ainda não têm nenhum registro
  const paymentMigrationRef = useRef(false)
  useEffect(() => {
    if (paymentMigrationRef.current || attendances.length === 0) return
    const avulsosNaEspera = waitlist.filter(a => a.player_type === 'avulso')
    if (avulsosNaEspera.length === 0) return
    paymentMigrationRef.current = true
    ;(async () => {
      try {
        const existingPayers = new Set<string>()
        await Promise.all(avulsosNaEspera.map(async a => {
          // Checa qualquer payment (pago ou não) para não duplicar
          const snap = await getDocs(query(collection(db, 'payments'),
            where('user_id', '==', a.user_id), where('game_id', '==', gameId)))
          if (!snap.empty) existingPayers.add(a.user_id)
        }))
        const toCreate = avulsosNaEspera.filter(a => !existingPayers.has(a.user_id))
        if (toCreate.length === 0) return
        const batch = writeBatch(db)
        toCreate.forEach(a => {
          batch.set(doc(collection(db, 'payments')), {
            user_id: a.user_id, amount: 22, type: 'jogo',
            game_id: gameId, month: gameId, paid: false, created_at: new Date().toISOString()
          })
        })
        await batch.commit()
        qc.invalidateQueries({ queryKey: ['payments'] })
      } catch { paymentMigrationRef.current = false }
    })()
  }, [attendances.length])

  // Correção: se a janela de prioridade está aberta, avulsos não devem estar como 'confirmed'
  useEffect(() => {
    if (!priorityOpen || confirmedAvulsos.length === 0 || attendances.length === 0) return
    const batch = writeBatch(db)
    confirmedAvulsos.forEach(a => {
      batch.update(doc(db, 'attendances', a.id), { status: 'waitlist' })
    })
    batch.commit().then(() => qc.invalidateQueries({ queryKey: ['attendances', gameId] }))
  }, [priorityOpen, confirmedAvulsos.length, attendances.length])

  // Promoção automática: após terça 13h, avulsos em espera são confirmados (admin dispara)
  const autoPromoteRef = useRef(false)
  useEffect(() => {
    if (priorityOpen || autoPromoteRef.current || !isAdmin || attendances.length === 0) return
    const spots = MAX_PLAYERS - confirmed.length - tempAvulsos.length
    if (spots <= 0) return
    const toPromote = waitlist.slice(0, spots)
    if (toPromote.length === 0) return
    autoPromoteRef.current = true
    ;(async () => {
      try {
        // Verifica pagamentos já existentes para não duplicar
        const avulsoIds = toPromote.filter(a => a.player_type === 'avulso').map(a => a.user_id)
        const existingPayers = new Set<string>()
        await Promise.all(avulsoIds.map(async uid => {
          const snap = await getDocs(query(collection(db, 'payments'), where('user_id', '==', uid), where('game_id', '==', gameId)))
          if (!snap.empty) existingPayers.add(uid)
        }))
        const batch = writeBatch(db)
        toPromote.forEach(a => {
          batch.update(doc(db, 'attendances', a.id), { status: 'confirmed' })
          if (a.player_type === 'avulso' && !existingPayers.has(a.user_id)) {
            batch.set(doc(collection(db, 'payments')), {
              user_id: a.user_id, amount: 22, type: 'jogo',
              game_id: gameId, month: gameId, paid: false,
              created_at: new Date().toISOString()
            })
          }
        })
        await batch.commit()
        qc.invalidateQueries({ queryKey: ['attendances', gameId] })
      } catch { autoPromoteRef.current = false }
    })()
  }, [priorityOpen, isAdmin, attendances.length])

  const pct = Math.min((totalConfirmed / MAX_PLAYERS) * 100, 100)
  const isPending = handleConfirm.isPending || handleDecline.isPending

  // Modo Chinelinho: bloqueia confirmação enquanto ativo e não expirado
  const chinelinhoActive = !!(
    user?.chinelinhoActive &&
    (!user.chinelinhoUntil || new Date(user.chinelinhoUntil) > new Date())
  )

  return (
    <div className="flex flex-col min-h-screen" style={{ background: 'var(--color-bg)', paddingBottom: 'calc(160px + env(safe-area-inset-bottom))' }}>

      <Header
        title="Nosso Jogo"
        subtitle={`${gameDateStr} | Quarta-feira, 21:30`}
        subtitle2="Campo 9E10"
        chinelinhoActive={chinelinhoActive}
        onChinelinhoClick={() => navigate('/profile')}
        rightContent={
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            {/* Bell com badge de unread */}
            <button
              onClick={() => navigate('/notifications')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, position: 'relative', display: 'flex' }}>
              <BellSimple size={24} color="var(--color-fg-primary)" />
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute', top: -4, right: -4,
                  width: 16, height: 16, borderRadius: '50%',
                  background: 'var(--color-fg-accent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-primary)', fontSize: 10, fontWeight: 700,
                  color: '#fff'
                }}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            {/* HandPalm — sair da pelada (só quando confirmado/espera e SEM modo chinelinho) */}
            {(amConfirmed || amInWaitlist) && !chinelinhoActive && (
              <button
                onClick={() => handleDecline.mutate()}
                disabled={isPending}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, opacity: isPending ? 0.4 : 1, display: 'flex' }}>
                <HandPalm size={24} color="var(--color-fg-primary)" />
              </button>
            )}
          </div>
        }
      />

      <div style={{ height: 104 }} />

      {/* Counter + progress */}
      <div className="px-6 mb-4">
        <div className="flex items-end justify-between mb-2">
          <p className="font-semibold" style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-24)', lineHeight: '28px' }}>
            Lista de<br />Presença
          </p>
          <div className="text-right">
            <p className="font-semibold" style={{ color: 'var(--color-fg-accent)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-24)' }}>
              {totalConfirmed}/{MAX_PLAYERS}
            </p>
            <p style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)' }}>
              confirmados
            </p>
          </div>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-primary)' }}>
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, background: isFull ? 'var(--color-danger)' : 'var(--color-surface-quaternary)' }} />
        </div>
      </div>

      {/* Aviso prazo mensalistas */}
      {priorityOpen && (
        <div className="mx-6 mb-4 px-4 flex items-center gap-2"
          style={{ background: 'var(--color-info-bg)', borderRadius: 8, paddingTop: 10, paddingBottom: 10 }}>
          <BellRinging size={16} color="var(--color-info-fg)" weight="fill" style={{ flexShrink: 0 }} />
          <p style={{ color: 'var(--color-info-fg)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-12)', fontWeight: 600, whiteSpace: 'nowrap' }}>
            Mensalistas terão prioridade até {deadlineStr}
          </p>
        </div>
      )}

      {/* Status do usuário */}
      {(amConfirmed || amInWaitlist || amDeclined) && (
        <div className="mx-6 mb-4 px-4 py-3 rounded-2xl flex items-center gap-2"
          style={{
            background: amConfirmed ? '#f0fdf4' : amInWaitlist ? '#fffbeb' : '#fff1f0',
            border: `1px solid ${amConfirmed ? '#bbf7d0' : amInWaitlist ? '#fde68a' : '#fecaca'}`
          }}>
          {amConfirmed
            ? <CheckCircle size={18} weight="fill" color="#089527" />
            : amInWaitlist
            ? <span>⏳</span>
            : <span>😅</span>}
          <p style={{ color: amConfirmed ? '#089527' : amInWaitlist ? '#92400e' : '#991b1b', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-14)' }}>
            {amConfirmed ? 'Você está confirmado' : amInWaitlist ? 'Você está na lista de espera' : 'Muié não deixou'}
          </p>
        </div>
      )}

      {/* Times escalados */}
      {hasLineup && (
        <>
          {myTeam && (
            <div className="mx-6 mb-3 px-4 py-2.5 flex items-center gap-2 rounded-lg"
              style={{ background: 'var(--color-info-bg)' }}>
              <BellRinging size={16} color="var(--color-info-fg)" weight="fill" style={{ flexShrink: 0 }} />
              <p style={{ color: 'var(--color-info-fg)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-11)', fontWeight: 400, whiteSpace: 'nowrap' }}>
                Você está no {myTeam === 'blue' ? 'Time Azul' : 'Time Preto'}
              </p>
            </div>
          )}

          {/* Tabs times */}
          <div className="mx-6 mb-3 p-2 flex gap-4 rounded-[20px]" style={{ background: 'var(--color-surface-secondary)' }}>
            {([['blue', 'Time Azul', '/team-blue.png'], ['black', 'Time Preto', '/team-yellow.png']] as const).map(([team, label, img]) => {
              const isActive = activeTeam === team
              return (
                <button key={team} onClick={() => setActiveTeam(team)}
                  className="flex-1 flex items-center justify-center gap-2 px-5 py-2 rounded-2xl transition-all"
                  style={{ background: isActive ? 'var(--color-tab-selected-bg)' : 'transparent' }}>
                  <img src={img} alt={label} width={24} height={24} style={{ objectFit: 'contain' }} />
                  <span style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)', fontWeight: 500 }}>{label}</span>
                </button>
              )
            })}
          </div>

          {/* Lista do time ativo */}
          <div className="px-6 flex flex-col gap-2">
            {(activeTeam === 'blue' ? lineup.blue : lineup.black).map((uid) => {
              const att = confirmed.find(a => a.user_id === uid)
              const tempAvulso = tempAvulsos.find(t => `temp_${t.id}` === uid)
              const name = att?.profile?.name || att?.profile?.email || tempAvulso?.name || uid
              const photoURL = (att?.profile as any)?.photoURL
              return (
                <div key={uid} className="flex items-center gap-3 px-4 py-4 rounded-3xl"
                  style={{ background: 'var(--color-surface-primary)' }}>
                  <Avatar name={name} photoURL={photoURL} />
                  <p className="flex-1" style={{ color: 'var(--color-item-fg)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)', fontWeight: 500 }}>
                    {name}
                  </p>
                  {isAdmin && att && (
                    <button onClick={() => setConfirmRemoveAttendance(att)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                      <X size={18} color="var(--color-fg-secondary)" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {/* Confirmados fora dos times — ex: confirmaram depois da escalação salva */}
          {(unassignedConfirmed.length > 0 || unassignedTempAvulsos.length > 0) && (
            <div className="px-6 mt-4 flex flex-col gap-2">
              <div className="flex items-center gap-1.5 mb-1">
                <p className="font-semibold uppercase tracking-wider" style={{ color: 'var(--color-fg-secondary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-12)' }}>
                  AGUARDANDO INCLUSÃO NO TIME ({unassignedConfirmed.length + unassignedTempAvulsos.length})
                </p>
              </div>
              {unassignedConfirmed.map((a, i) => (
                <PlayerRow key={a.id} attendance={a} index={i + 1} isMe={a.user_id === user?.id}
                  onRemove={isAdmin ? () => setConfirmRemoveAttendance(a) : undefined} />
              ))}
              {unassignedTempAvulsos.map(t => (
                <div key={t.id} className="flex items-center gap-3 px-4 py-4 rounded-3xl"
                  style={{ background: 'var(--color-surface-primary)' }}>
                  <Avatar name={t.name} />
                  <p className="flex-1" style={{ color: 'var(--color-item-fg)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)', fontWeight: 500 }}>
                    {t.name}
                  </p>
                </div>
              ))}
              {isAdmin && (
                <button onClick={() => navigate('/escalacao')}
                  className="mt-1 py-3 font-medium transition-all active:scale-95"
                  style={{ background: 'var(--color-surface-accent-light)', color: 'var(--color-fg-accent)', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-14)', fontWeight: 500 }}>
                  Adicionar a um time
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* Listas — apenas quando não tem lineup */}
      {!hasLineup && (isLoading ? (
        <div className="flex justify-center py-8"><div className="text-4xl animate-spin">⚽</div></div>
      ) : (
        <div className="px-6 flex flex-col gap-2">
          {confirmed.length > 0 && (
            <>
              <div className="flex items-center gap-1.5 mt-2 mb-1">
                <p className="font-semibold uppercase tracking-wider" style={{ color: 'var(--color-fg-secondary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-12)' }}>
                  CONFIRMADOS ({confirmed.length})
                </p>
              </div>
              {confirmed.map((a, i) => (
                <PlayerRow key={a.id} attendance={a} index={i + 1} isMe={a.user_id === user?.id}
                  onRemove={isAdmin ? () => setConfirmRemoveAttendance(a) : undefined} />
              ))}
            </>
          )}

          {confirmed.length === 0 && (
            <p className="text-center py-6" style={{ color: 'var(--color-fg-secondary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)' }}>
              Ninguém confirmado ainda 🙋
            </p>
          )}

          {waitlist.length > 0 && (
            <>
              <div className="flex items-center justify-between mt-4 mb-1">
                <p className="font-semibold uppercase tracking-wider" style={{ color: 'var(--color-fg-secondary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-12)' }}>
                  LISTA DE ESPERA
                </p>
                <div className="px-3 py-1 rounded-2xl" style={{ background: 'var(--color-surface-primary)' }}>
                  <p style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-14)' }}>
                    {waitlist.length} jogadores
                  </p>
                </div>
              </div>
              {waitlist.map((a, i) => (
                <PlayerRow key={a.id} attendance={a} index={i + 1} isMe={a.user_id === user?.id} waitlist />
              ))}
            </>
          )}

          {tempAvulsos.length > 0 && (
            <p className="font-semibold uppercase tracking-wider mt-3 mb-1" style={{ color: 'var(--color-fg-secondary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-12)' }}>
              AVULSOS TEMPORÁRIOS ({tempAvulsos.length})
            </p>
          )}
          {tempAvulsos.map((t) => {
            const canManage = t.addedBy === user?.id || isAdmin
            return (
              <button key={t.id}
                onClick={() => canManage && setSelectedTempAvulso(t)}
                className="flex items-center gap-3 p-4 rounded-3xl w-full transition-all active:scale-[0.99]"
                style={{ background: 'var(--color-surface-primary)', border: '1.5px solid transparent', cursor: canManage ? 'pointer' : 'default', textAlign: 'left' }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: 'var(--color-surface-secondary)' }}>
                  <span style={{ fontFamily: 'var(--font-primary)', fontSize: 14, fontWeight: 500, color: 'var(--color-fg-secondary)' }}>
                    {getInitials(t.name)}
                  </span>
                </div>
                <p className="flex-1 font-medium truncate"
                  style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)' }}>
                  {t.name}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{ background: '#fff3cd', color: '#856404', fontFamily: 'var(--font-primary)' }}>
                    Temp
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{ background: '#e6f4ea', color: '#166634', fontFamily: 'var(--font-primary)' }}>
                    R$22
                  </span>
                </div>
              </button>
            )
          })}

          {toConfirm.length > 0 && (
            <>
              <p className="font-semibold uppercase tracking-wider mt-3 mb-1" style={{ color: 'var(--color-fg-secondary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-12)' }}>
                À CONFIRMAR ({toConfirm.length})
              </p>
              {toConfirm.map(p => (
                <div key={p.id} className="flex items-center gap-3 p-4 rounded-3xl"
                  style={{ background: 'var(--color-surface-primary)', opacity: 0.55 }}>
                  <Avatar name={p.name} photoURL={p.photoURL} />
                  <p className="flex-1 font-medium truncate" style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)' }}>
                    {p.name}
                  </p>
                </div>
              ))}
            </>
          )}
        </div>
      ))}

      {/* Card oculto para compartilhar */}
      {hasLineup && (
        <div ref={shareCardRef} style={{ position: 'absolute', left: '-9999px', top: 0, width: 390, padding: '24px', background: '#ffffff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <img src="/logo.png" alt="ChicoFC" width={32} height={32} style={{ borderRadius: 8 }} />
            <p style={{ fontFamily: 'var(--font-primary)', fontSize: 20, fontWeight: 700, color: '#1a1a1a' }}>ChicoFC ⚽</p>
          </div>
          {(['blue', 'black'] as const).map(team => {
            const ids = team === 'blue' ? lineup.blue : lineup.black
            const label = team === 'blue' ? 'Time Azul' : 'Time Preto'
            const img = team === 'blue' ? '/team-blue.png' : '/team-yellow.png'
            return (
              <div key={team} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <img src={img} alt={label} width={20} height={20} />
                  <p style={{ fontFamily: 'var(--font-primary)', fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>{label}</p>
                </div>
                {ids.map((uid, i) => {
                  const att = confirmed.find(a => a.user_id === uid)
                  const tempAvulso = tempAvulsos.find(t => `temp_${t.id}` === uid)
                  const name = (att as any)?.profile?.name || (att as any)?.profile?.email || tempAvulso?.name || uid
                  return (
                    <div key={uid} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', marginBottom: 4, borderRadius: 12, background: '#f8f8f8' }}>
                      <span style={{ fontFamily: 'var(--font-primary)', fontSize: 13, color: '#8e8e93', width: 18 }}>{i + 1}</span>
                      <span style={{ fontFamily: 'var(--font-primary)', fontSize: 14, fontWeight: 500, color: '#1a1a1a' }}>{name}</span>
                    </div>
                  )
                })}
              </div>
            )
          })}
          <p style={{ fontFamily: 'var(--font-primary)', fontSize: 11, color: '#8e8e93', textAlign: 'center', marginTop: 12 }}>chicofc.vercel.app</p>
        </div>
      )}

      {/* Botões fixos — Admin confirmado */}
      {isAdmin && (amConfirmed || amInWaitlist || listaClosed) && (showAvulsoBtn || showEscalarBtn) && (
        <div className="fixed inset-x-0 px-6 pt-4 pb-3 flex gap-2"
          style={{ bottom: 'calc(var(--bottom-nav-height) + env(safe-area-inset-bottom))', background: 'var(--color-bg)', borderTop: '1px solid var(--color-border)' }}>
          {showEscalarBtn && (
            <button onClick={() => navigate('/escalacao')}
              className="flex-1 py-4 font-medium transition-all active:scale-95"
              style={{ background: 'var(--color-surface-accent-light)', color: 'var(--color-fg-accent)', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-14)', fontWeight: 500 }}>
              {hasLineup ? 'Editar Times' : 'Escalar Times'}
            </button>
          )}
          {showAvulsoBtn && (
            <button onClick={() => setShowAvulsoSheet(true)}
              className="flex-1 py-4 font-medium transition-all active:scale-95"
              style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-fg)', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-primary)', fontSize: showAvulsoBtn && showEscalarBtn ? 'var(--font-size-12)' : 'var(--font-size-14)', fontWeight: 500 }}>
              + Avulso Temp.
            </button>
          )}
        </div>
      )}

      {/* Botões fixos — Admin NÃO confirmado: [Escalar] + Confirmar Presença + Muié não deixa */}
      {isAdmin && !amConfirmed && !amInWaitlist && !listaClosed && (showEscalarBtn || !chinelinhoActive) && (
        <div className="fixed inset-x-0 px-6 pt-4 pb-3 flex gap-2"
          style={{ bottom: 'calc(var(--bottom-nav-height) + env(safe-area-inset-bottom))', background: 'var(--color-bg)', borderTop: '1px solid var(--color-border)' }}>
          {showEscalarBtn && (
            <button onClick={() => navigate('/escalacao')}
              className="flex-1 py-4 font-medium transition-all active:scale-95"
              style={{ background: 'var(--color-surface-accent-light)', color: 'var(--color-fg-accent)', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-12)', fontWeight: 500 }}>
              {hasLineup ? 'Editar Times' : 'Escalar Times'}
            </button>
          )}
          {amDeclined && avulsoWindowOpen ? (
            <button
              onClick={() => setShowAvulsoSheet(true)}
              className="flex-1 py-4 font-medium transition-all active:scale-95"
              style={{ background: 'var(--btn-secondary-bg)', color: 'var(--btn-secondary-fg)', border: '1px solid var(--btn-secondary-border)', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-primary)', fontSize: showEscalarBtn ? 'var(--font-size-12)' : 'var(--font-size-16)', fontWeight: 500 }}>
              Adicionar Avulso
            </button>
          ) : !chinelinhoActive ? (
            <button
              onClick={() => !amDeclined && setShowDeclineSheet(true)}
              disabled={isPending || amDeclined}
              className="flex-1 py-4 font-medium transition-all active:scale-95 disabled:opacity-40"
              style={{ background: 'var(--btn-secondary-bg)', color: 'var(--btn-secondary-fg)', border: '1px solid var(--btn-secondary-border)', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-primary)', fontSize: showEscalarBtn ? 'var(--font-size-12)' : 'var(--font-size-16)', fontWeight: 500, opacity: amDeclined ? 0.5 : 1 }}>
              Muié não deixa
            </button>
          ) : null}
          {!chinelinhoActive && (
            <button
              onClick={() => handleConfirm.mutate()}
              disabled={isPending}
              className="flex-1 py-4 font-medium transition-all active:scale-95 disabled:opacity-40"
              style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-fg)', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-primary)', fontSize: showEscalarBtn ? 'var(--font-size-12)' : 'var(--font-size-16)', fontWeight: 500 }}>
              {handleConfirm.isPending ? '...' : 'Confirmar Presença'}
            </button>
          )}
        </div>
      )}

      {/* Botões fixos — Jogador não confirmado: Muié não deixa / Bora Jogar (sempre à direita) */}
      {!isAdmin && !amConfirmed && !amInWaitlist && !listaClosed && !chinelinhoActive && (
        <div className="fixed inset-x-0 px-6 pt-4 pb-3 flex gap-2"
          style={{ bottom: 'calc(var(--bottom-nav-height) + env(safe-area-inset-bottom))', background: 'var(--color-bg)', backdropFilter: 'blur(12px)', borderTop: '1px solid var(--color-border)' }}>
          {amDeclined && avulsoWindowOpen ? (
            <button
              onClick={() => setShowAvulsoSheet(true)}
              className="flex-1 py-4 font-medium transition-all active:scale-95"
              style={{ background: 'var(--btn-secondary-bg)', color: 'var(--btn-secondary-fg)', border: '1px solid var(--btn-secondary-border)', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)', fontWeight: 500 }}>
              Adicionar Avulso
            </button>
          ) : (
            <button
              onClick={() => !amDeclined && setShowDeclineSheet(true)}
              disabled={isPending || amDeclined}
              className="flex-1 py-4 font-medium transition-all active:scale-95 disabled:opacity-40"
              style={{ background: 'var(--btn-secondary-bg)', color: 'var(--btn-secondary-fg)', border: '1px solid var(--btn-secondary-border)', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)', fontWeight: 500, opacity: amDeclined ? 0.5 : 1 }}>
              Muié não deixa
            </button>
          )}
          <button
            onClick={() => handleConfirm.mutate()}
            disabled={isPending}
            className="flex-1 py-4 font-medium transition-all active:scale-95 disabled:opacity-40"
            style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-fg)', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)', fontWeight: 500 }}>
            {handleConfirm.isPending ? '...' : 'Bora Jogar'}
          </button>
        </div>
      )}

      {/* Botão fixo — Adicionar Avulso Temporário (apenas não-admin; admin já tem na barra) */}
      {showAvulsoBtn && !isAdmin && (
        <div className="fixed inset-x-0 px-6 pt-4 pb-3"
          style={{ bottom: 'calc(var(--bottom-nav-height) + env(safe-area-inset-bottom))', zIndex: 50 }}>
          <button
            onClick={() => setShowAvulsoSheet(true)}
            className="w-full transition-all active:scale-95"
            style={{
              height: 56, borderRadius: 9999,
              background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-fg)',
              fontFamily: 'var(--font-primary)', fontWeight: 500, fontSize: 'var(--font-size-16)',
              border: 'none', cursor: 'pointer'
            }}>
            Adicionar Avulso Temporário
          </button>
        </div>
      )}

      {/* Bottom sheet — Detalhe avulso temporário */}
      {selectedTempAvulso && (
        <>
          <div onClick={() => setSelectedTempAvulso(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 60 }} />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 70,
            background: 'white', borderRadius: '24px 24px 0 0',
            padding: '24px 24px 40px', display: 'flex', flexDirection: 'column', gap: 16
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 600, fontSize: 'var(--font-size-16)', color: 'var(--color-fg-primary)' }}>
                Avulso Temporário
              </p>
              <button onClick={() => setSelectedTempAvulso(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                <X size={20} color="var(--color-fg-secondary)" />
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
                background: 'var(--color-surface-secondary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <span style={{ fontFamily: 'var(--font-primary)', fontSize: 16, fontWeight: 500, color: 'var(--color-fg-secondary)' }}>
                  {getInitials(selectedTempAvulso.name)}
                </span>
              </div>
              <div>
                <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 500, fontSize: 'var(--font-size-16)', color: 'var(--color-fg-primary)' }}>
                  {selectedTempAvulso.name}
                </p>
                <p style={{ fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-12)', color: 'var(--color-fg-secondary)' }}>
                  Adicionado por {selectedTempAvulso.addedByName}
                </p>
              </div>
            </div>
            <button
              onClick={() => removeAvulso.mutate(selectedTempAvulso.id)}
              disabled={removeAvulso.isPending}
              className="w-full transition-all active:scale-95 disabled:opacity-40"
              style={{
                background: 'var(--color-danger)', border: 'none', cursor: 'pointer',
                borderRadius: 'var(--radius-pill)', padding: '16px 24px',
                fontFamily: 'var(--font-primary)', fontWeight: 500,
                fontSize: 'var(--font-size-16)', color: 'white'
              }}>
              {removeAvulso.isPending ? 'Removendo...' : 'Excluir Avulso'}
            </button>
          </div>
        </>
      )}

      {/* Bottom sheet — Admin: confirmar remoção de jogador */}
      {confirmRemoveAttendance && (
        <>
          <div onClick={() => setConfirmRemoveAttendance(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 60 }} />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 70,
            background: 'var(--color-bg)', borderRadius: '24px 24px 0 0',
            padding: '24px 24px calc(32px + env(safe-area-inset-bottom))',
            display: 'flex', flexDirection: 'column', gap: 20
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 600, fontSize: 18, color: 'var(--color-fg-primary)' }}>
                Remover da partida
              </p>
              <button onClick={() => setConfirmRemoveAttendance(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}>
                <X size={20} color="var(--color-fg-secondary)" />
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 16, background: 'var(--color-surface-primary)' }}>
              <Avatar
                name={(confirmRemoveAttendance.profile as any)?.name || 'Jogador'}
                photoURL={(confirmRemoveAttendance.profile as any)?.photoURL}
              />
              <div>
                <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 500, fontSize: 16, color: 'var(--color-fg-primary)' }}>
                  {(confirmRemoveAttendance.profile as any)?.name || (confirmRemoveAttendance.profile as any)?.email || 'Jogador'}
                </p>
                <p style={{ fontFamily: 'var(--font-primary)', fontSize: 13, color: 'var(--color-fg-secondary)', marginTop: 2 }}>
                  {confirmRemoveAttendance.player_type === 'mensalista' ? 'Mensalista' : 'Avulso'}
                </p>
              </div>
            </div>

            <p style={{ fontFamily: 'var(--font-primary)', fontSize: 14, color: 'var(--color-fg-secondary)', lineHeight: 1.5 }}>
              {waitlist.length > 0
                ? `A vaga será aberta para ${(waitlist[0].profile as any)?.name || (waitlist[0].profile as any)?.email || 'o próximo da lista de espera'}.`
                : 'Não há ninguém na lista de espera. A vaga ficará aberta.'}
            </p>

            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setConfirmRemoveAttendance(null)}
                className="flex-1 transition-all active:scale-95"
                style={{ height: 56, borderRadius: 9999, background: 'var(--color-surface-primary)', border: 'none', fontFamily: 'var(--font-primary)', fontWeight: 500, fontSize: 16, color: 'var(--color-fg-primary)', cursor: 'pointer' }}>
                Cancelar
              </button>
              <button
                onClick={() => adminRemovePlayer.mutate(confirmRemoveAttendance)}
                disabled={adminRemovePlayer.isPending}
                className="flex-1 transition-all active:scale-95 disabled:opacity-40"
                style={{ height: 56, borderRadius: 9999, background: '#ef4444', border: 'none', fontFamily: 'var(--font-primary)', fontWeight: 600, fontSize: 16, color: '#fff', cursor: 'pointer' }}>
                {adminRemovePlayer.isPending ? 'Removendo...' : 'Remover'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Bottom sheet — Confirmar ausência ou convidar avulso no lugar */}
      {showDeclineSheet && (
        <>
          <div onClick={() => setShowDeclineSheet(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 60 }} />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 70,
            background: 'var(--color-bg)', borderRadius: '24px 24px 0 0',
            padding: '24px 24px calc(32px + env(safe-area-inset-bottom))',
            display: 'flex', flexDirection: 'column', gap: 20
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 600, fontSize: 18, color: 'var(--color-fg-primary)' }}>
                Não vai dar pra jogar?
              </p>
              <button onClick={() => setShowDeclineSheet(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}>
                <X size={20} color="var(--color-fg-secondary)" />
              </button>
            </div>

            <p style={{ fontFamily: 'var(--font-primary)', fontSize: 14, color: 'var(--color-fg-secondary)', lineHeight: 1.5 }}>
              Confirme sua ausência ou convide um avulso temporário pra puxar sua vaga.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button
                onClick={() => { setShowDeclineSheet(false); handleDecline.mutate() }}
                disabled={isPending}
                className="w-full transition-all active:scale-95 disabled:opacity-40"
                style={{
                  height: 56, borderRadius: 9999,
                  background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-fg)',
                  border: 'none', fontFamily: 'var(--font-primary)', fontWeight: 500, fontSize: 16, cursor: 'pointer'
                }}>
                Confirmar
              </button>
              {avulsoWindowOpen && (
                <button
                  onClick={() => { setShowDeclineSheet(false); setShowAvulsoSheet(true) }}
                  className="w-full transition-all active:scale-95"
                  style={{
                    height: 56, borderRadius: 9999,
                    background: 'var(--btn-secondary-bg)', color: 'var(--btn-secondary-fg)',
                    border: '1px solid var(--btn-secondary-border)',
                    fontFamily: 'var(--font-primary)', fontWeight: 500, fontSize: 16, cursor: 'pointer'
                  }}>
                  Convidar Avulso Temporário
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* Bottom sheet — Avulso Temporário */}
      {showAvulsoSheet && (
        <>
          <div onClick={() => { setShowAvulsoSheet(false); setAvulsoName('') }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 60 }} />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 70,
            background: 'white', borderRadius: '24px 24px 0 0',
            padding: '24px 24px 40px', display: 'flex', flexDirection: 'column', gap: 24
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 600, fontSize: 16, color: 'var(--color-fg-primary)' }}>
                Adicionar Avulso Temporário
              </p>
              <button onClick={() => { setShowAvulsoSheet(false); setAvulsoName('') }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}>
                <X size={20} color="var(--color-fg-secondary)" />
              </button>
            </div>
            <input
              type="text"
              placeholder="Nome do jogador"
              value={avulsoName}
              onChange={e => setAvulsoName(e.target.value)}
              style={{
                width: '100%', height: 56, borderRadius: 9999,
                background: 'var(--color-surface-primary)', border: 'none',
                padding: '0 24px', fontFamily: 'var(--font-primary)', fontSize: 16,
                color: 'var(--color-fg-primary)', outline: 'none', boxSizing: 'border-box'
              }}
            />
            <button
              onClick={() => addAvulso.mutate()}
              disabled={!avulsoName.trim() || addAvulso.isPending}
              className="transition-all active:scale-95 disabled:opacity-40"
              style={{
                width: '100%', height: 56, borderRadius: 9999,
                background: avulsoName.trim() ? 'var(--btn-primary-bg)' : 'var(--color-surface-secondary)',
                color: avulsoName.trim() ? 'var(--btn-primary-fg)' : 'var(--color-fg-secondary)',
                fontFamily: 'var(--font-primary)', fontWeight: 500, fontSize: 16,
                border: 'none', cursor: avulsoName.trim() ? 'pointer' : 'default'
              }}>
              {addAvulso.isPending ? 'Adicionando...' : 'Adicionar'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function ChinelinhoTag() {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      height: 24, padding: '1px 8px',
      background: 'var(--color-surface-primary)',
      border: '1px solid var(--color-border)',
      borderRadius: 16, flexShrink: 0, whiteSpace: 'nowrap'
    }}>
      <span style={{ fontFamily: 'var(--font-primary)', fontSize: 11, fontWeight: 400, color: 'var(--color-fg-primary)', lineHeight: 1 }}>
        Modo Chinelinho
      </span>
      <span style={{ fontSize: 13, lineHeight: 1 }}>🩴</span>
    </span>
  )
}

function isChinelinho(profile: any): boolean {
  return !!(profile?.chinelinhoActive && (!profile?.chinelinhoUntil || new Date(profile.chinelinhoUntil) > new Date()))
}

function PlayerRow({ attendance, index, isMe, waitlist = false, onRemove }: {
  attendance: Attendance; index: number; isMe: boolean; waitlist?: boolean; onRemove?: () => void
}) {
  const name = (attendance.profile as any)?.name || (attendance.profile as any)?.email || 'Jogador'
  const photoURL = (attendance.profile as any)?.photoURL
  const chinelinho = isChinelinho(attendance.profile)

  return (
    <div className="flex items-center gap-3 p-4 rounded-3xl"
      style={{
        background: 'var(--color-surface-primary)',
        opacity: waitlist ? 0.65 : 1,
        border: isMe ? '1.5px solid var(--color-fg-accent-light)' : '1.5px solid transparent'
      }}>

      <Avatar name={name} photoURL={photoURL} />

      <p className="flex-1 font-medium truncate"
        style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)' }}>
        {name}
        {isMe && <span className="ml-1" style={{ color: 'var(--color-fg-secondary)', fontSize: 'var(--font-size-14)' }}>(você)</span>}
      </p>

      {chinelinho && <ChinelinhoTag />}

      {!chinelinho && attendance.player_type === 'avulso' && (
        <span className="px-2 py-0.5 rounded-full text-xs font-medium"
          style={{ background: '#e6f4ea', color: '#166634', fontFamily: 'var(--font-primary)' }}>
          R$22
        </span>
      )}
      {!chinelinho && attendance.player_type === 'mensalista' && !waitlist && (
        <span className="px-2 py-0.5 rounded-full text-xs font-medium"
          style={{ background: '#fff3cd', color: '#856404', fontFamily: 'var(--font-primary)' }}>
          Mensalista
        </span>
      )}
      {onRemove && (
        <button onClick={onRemove}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', flexShrink: 0, marginLeft: 2 }}>
          <X size={18} color="var(--color-fg-secondary)" />
        </button>
      )}
    </div>
  )
}

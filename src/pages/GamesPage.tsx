import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { collection, getDocs, query, where, doc, getDoc, writeBatch } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuthStore } from '../store/authStore'
import { format, isAfter, nextWednesday, isWednesday, startOfDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Crown } from '@phosphor-icons/react'
import { toast } from 'sonner'
import type { Attendance } from '../types'

const MAX_PLAYERS = 14

function getNextWednesday(): Date {
  const today = startOfDay(new Date())
  if (isWednesday(today)) return today
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

export default function GamesPage() {
  const user = useAuthStore(s => s.user)
  const qc = useQueryClient()

  const gameDate = getNextWednesday()
  const gameId = getGameId(gameDate)
  const priorityOpen = isPriorityWindowOpen(gameDate)
  const deadline = getPriorityDeadline(gameDate)
  const deadlineStr = format(deadline, "EEE dd/MM 'às' HH'h'mm", { locale: ptBR })

  const { data: attendances = [], isLoading } = useQuery({
    queryKey: ['attendances', gameId],
    queryFn: () => fetchAttendances(gameId)
  })

  const myAttendance = attendances.find(a => a.user_id === user?.id)
  const confirmed = attendances.filter(a => a.status === 'confirmed')
  const waitlist = attendances.filter(a => a.status === 'waitlist')
  const declined = attendances.filter(a => a.status === 'declined')
  const confirmedMensalistas = confirmed.filter(a => a.player_type === 'mensalista')
  const confirmedAvulsos = confirmed.filter(a => a.player_type === 'avulso')
  const isFull = confirmed.length >= MAX_PLAYERS
  const amConfirmed = myAttendance?.status === 'confirmed'
  const amInWaitlist = myAttendance?.status === 'waitlist'
  const amDeclined = myAttendance?.status === 'declined'

  // Confirmar presença
  const handleConfirm = useMutation({
    mutationFn: async () => {
      const batch = writeBatch(db)

      if (myAttendance) {
        // Atualiza status existente
        batch.update(doc(db, 'attendances', myAttendance.id), { status: 'confirmed' })
      } else {
        const playerType = user!.player_type ?? 'avulso'
        const status: 'confirmed' | 'waitlist' = isFull || (playerType === 'avulso' && priorityOpen) ? 'waitlist' : 'confirmed'
        const attRef = doc(collection(db, 'attendances'))
        batch.set(attRef, {
          game_id: gameId,
          user_id: user!.id,
          player_type: playerType,
          status,
          confirmed_at: new Date().toISOString()
        })
        if (status === 'confirmed' && playerType === 'avulso') {
          const payRef = doc(collection(db, 'payments'))
          batch.set(payRef, {
            user_id: user!.id, amount: 22, type: 'jogo',
            game_id: gameId, month: gameId, paid: false, created_at: new Date().toISOString()
          })
        }
      }
      await batch.commit()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendances', gameId] })
      const playerType = user!.player_type ?? 'avulso'
      if (isFull || (playerType === 'avulso' && priorityOpen)) {
        toast('Na lista de espera ⏳')
      } else {
        toast.success('Bora jogar! 🙌')
      }
    },
    onError: () => toast.error('Erro ao confirmar presença')
  })

  // Recusar / "Muié não deixa"
  const handleDecline = useMutation({
    mutationFn: async () => {
      const batch = writeBatch(db)

      if (myAttendance) {
        // Se estava confirmado, promove próximo da espera
        if (myAttendance.status === 'confirmed' && waitlist.length > 0) {
          const next = waitlist[0]
          batch.update(doc(db, 'attendances', next.id), { status: 'confirmed' })
          if (next.player_type === 'avulso') {
            const payRef = doc(collection(db, 'payments'))
            batch.set(payRef, {
              user_id: next.user_id, amount: 22, type: 'jogo',
              game_id: gameId, month: gameId, paid: false, created_at: new Date().toISOString()
            })
          }
        }
        batch.update(doc(db, 'attendances', myAttendance.id), { status: 'declined' })
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
      toast('Muié não deixou 😅')
    },
    onError: () => toast.error('Erro ao registrar ausência')
  })

  const pct = Math.min((confirmed.length / MAX_PLAYERS) * 100, 100)
  const isPending = handleConfirm.isPending || handleDecline.isPending

  return (
    <div className="flex flex-col min-h-full pb-40" style={{ background: 'var(--color-bg)' }}>

      {/* Header */}
      <div className="px-6 pt-12 pb-4 flex items-start justify-between">
        <div>
          <p className="font-semibold" style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-24)', lineHeight: '28px' }}>
            Próximo Jogo
          </p>
          <p style={{ color: 'var(--color-fg-secondary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)' }}>
            Dia: Quarta-feira, 21:30
          </p>
          <p style={{ color: 'var(--color-fg-secondary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)' }}>
            Local: 9E10
          </p>
        </div>

        {/* Botão Sair — aparece só quando está confirmado ou na espera */}
        {(amConfirmed || amInWaitlist) && (
          <button
            onClick={() => handleDecline.mutate()}
            disabled={isPending}
            className="transition-all active:scale-95 disabled:opacity-40"
            style={{
              background: 'var(--color-surface-accent-light)',
              color: 'var(--color-fg-accent)',
              borderRadius: 'var(--radius-pill)',
              fontFamily: 'var(--font-primary)',
              fontSize: 'var(--font-size-14)',
              fontWeight: 500,
              padding: '8px 16px',
              marginTop: 4,
              flexShrink: 0
            }}
          >
            Sair
          </button>
        )}
      </div>

      {/* Counter + progress */}
      <div className="px-6 mb-4">
        <div className="flex items-end justify-between mb-2">
          <p className="font-semibold" style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-24)', lineHeight: '28px' }}>
            Lista de<br />Presença
          </p>
          <div className="text-right">
            <p className="font-semibold" style={{ color: 'var(--color-fg-accent)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-24)' }}>
              {confirmed.length}/{MAX_PLAYERS}
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

      {/* Aviso prazo */}
      {priorityOpen && (
        <div className="mx-6 mb-4 px-4 py-3 rounded-2xl flex items-center gap-2"
          style={{ background: '#fff8e6', border: '1px solid #ffd580' }}>
          <span>⏰</span>
          <p style={{ color: '#b45309', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-14)' }}>
            Prioridade mensalistas até <strong>{deadlineStr}</strong>
          </p>
        </div>
      )}

      {/* Status */}
      {(amConfirmed || amInWaitlist || amDeclined) && (
        <div className="mx-6 mb-4 px-4 py-3 rounded-2xl flex items-center gap-2"
          style={{
            background: amConfirmed ? '#f0fdf4' : amInWaitlist ? '#fffbeb' : '#fff1f0',
            border: `1px solid ${amConfirmed ? '#bbf7d0' : amInWaitlist ? '#fde68a' : '#fecaca'}`
          }}>
          <span>{amConfirmed ? '✓' : amInWaitlist ? '⏳' : '😅'}</span>
          <p style={{ color: amConfirmed ? '#166534' : amInWaitlist ? '#92400e' : '#991b1b', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-14)' }}>
            {amConfirmed ? 'Você está confirmado' : amInWaitlist ? 'Você está na lista de espera' : 'Muié não deixou'}
          </p>
        </div>
      )}

      {/* Listas */}
      {isLoading ? (
        <div className="flex justify-center py-8"><div className="text-4xl animate-spin">⚽</div></div>
      ) : (
        <div className="px-6 flex flex-col gap-2">
          {confirmedMensalistas.length > 0 && (
            <>
              <div className="flex items-center gap-1.5 mt-2 mb-1">
                <Crown size={12} color="#f59e0b" weight="fill" />
                <p className="font-semibold uppercase tracking-wider" style={{ color: 'var(--color-fg-secondary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-12)' }}>
                  Mensalistas ({confirmedMensalistas.length})
                </p>
              </div>
              {confirmedMensalistas.map((a, i) => (
                <PlayerRow key={a.id} attendance={a} index={i + 1} isMe={a.user_id === user?.id} />
              ))}
            </>
          )}

          {confirmedAvulsos.length > 0 && (
            <>
              <p className="font-semibold uppercase tracking-wider mt-3 mb-1" style={{ color: 'var(--color-fg-secondary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-12)' }}>
                Avulsos ({confirmedAvulsos.length})
              </p>
              {confirmedAvulsos.map((a, i) => (
                <PlayerRow key={a.id} attendance={a} index={confirmedMensalistas.length + i + 1} isMe={a.user_id === user?.id} />
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
                <p className="font-semibold" style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)' }}>
                  Lista de espera
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
        </div>
      )}

      {/* Botões fixos no rodapé — dois botões lado a lado quando não está na lista */}
      {!amConfirmed && !amInWaitlist && (
        <div className="fixed inset-x-0 px-6 pt-4 pb-3 flex gap-2"
          style={{ bottom: 90, background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(12px)', borderTop: '1px solid var(--color-border)' }}>
          <button
            onClick={() => handleConfirm.mutate()}
            disabled={isPending}
            className="flex-1 py-4 font-medium transition-all active:scale-95 disabled:opacity-40"
            style={{ background: 'var(--color-surface-accent)', color: 'white', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)', fontWeight: 500 }}>
            {handleConfirm.isPending ? '...' : 'Bora Jogar'}
          </button>
          <button
            onClick={() => handleDecline.mutate()}
            disabled={isPending}
            className="flex-1 py-4 font-medium transition-all active:scale-95 disabled:opacity-40"
            style={{ background: 'var(--color-surface-accent-light)', color: 'var(--color-fg-accent)', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)', fontWeight: 500 }}>
            {handleDecline.isPending ? '...' : 'Muié não deixa'}
          </button>
        </div>
      )}

      {/* Se recusou, mostra só o botão Bora Jogar para mudar de ideia */}
      {amDeclined && (
        <div className="fixed inset-x-0 px-6 pt-4 pb-3"
          style={{ bottom: 90, background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(12px)', borderTop: '1px solid var(--color-border)' }}>
          <button
            onClick={() => handleConfirm.mutate()}
            disabled={isPending}
            className="w-full py-4 font-medium transition-all active:scale-95 disabled:opacity-40"
            style={{ background: 'var(--color-surface-accent)', color: 'white', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)', fontWeight: 500 }}>
            {handleConfirm.isPending ? '...' : 'Bora Jogar'}
          </button>
        </div>
      )}
    </div>
  )
}

function PlayerRow({ attendance, index, isMe, waitlist = false }: {
  attendance: Attendance; index: number; isMe: boolean; waitlist?: boolean
}) {
  const name = (attendance.profile as any)?.name || (attendance.profile as any)?.email || 'Jogador'
  return (
    <div className="flex items-center gap-3 p-4 rounded-3xl"
      style={{
        background: isMe ? 'var(--color-surface-accent-light)' : 'var(--color-surface-primary)',
        opacity: waitlist ? 0.65 : 1,
        border: isMe ? '1.5px solid var(--color-fg-accent)' : '1.5px solid transparent'
      }}>
      <div className="w-8 h-8 rounded-full flex items-center justify-center font-semibold shrink-0"
        style={{ background: 'var(--color-surface-white)', border: '2px solid var(--color-surface-secondary)', color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)' }}>
        {waitlist ? '⏳' : index}
      </div>
      <p className="flex-1 font-medium truncate" style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)' }}>
        {name}
        {isMe && <span className="ml-1" style={{ color: 'var(--color-fg-secondary)', fontSize: 'var(--font-size-14)' }}>(você)</span>}
      </p>
      {attendance.player_type === 'avulso' && !waitlist && (
        <span className="px-2 py-0.5 rounded-full text-xs font-medium"
          style={{ background: '#e6f4ea', color: '#166534', fontFamily: 'var(--font-primary)' }}>
          R$22
        </span>
      )}
    </div>
  )
}

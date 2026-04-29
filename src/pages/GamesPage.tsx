import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { collection, getDocs, query, where, doc, getDoc, writeBatch } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuthStore } from '../store/authStore'
import { format, isAfter, nextWednesday, isWednesday, startOfDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { MapPin, Clock, CheckCircle2, XCircle, Clock3, Crown } from 'lucide-react'
import { toast } from 'sonner'
import type { Attendance } from '../types'

const MAX_PLAYERS = 14

// Calcula a próxima quarta-feira (ou hoje se já for quarta)
function getNextWednesday(): Date {
  const today = startOfDay(new Date())
  if (isWednesday(today)) return today
  return nextWednesday(today)
}

// ID do jogo baseado na data (ex: "2025-04-30")
function getGameId(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

// Prazo de prioridade: terça-feira às 13:00
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
  const gameDateStr = format(gameDate, "d 'de' MMMM", { locale: ptBR })

  const { data: attendances = [], isLoading } = useQuery({
    queryKey: ['attendances', gameId],
    queryFn: () => fetchAttendances(gameId)
  })

  const myAttendance = attendances.find(a => a.user_id === user?.id)
  const confirmed = attendances.filter(a => a.status === 'confirmed')
  const waitlist = attendances.filter(a => a.status === 'waitlist')
  const confirmedMensalistas = confirmed.filter(a => a.player_type === 'mensalista')
  const confirmedAvulsos = confirmed.filter(a => a.player_type === 'avulso')
  const isFull = confirmed.length >= MAX_PLAYERS
  const amConfirmed = myAttendance?.status === 'confirmed'
  const amInWaitlist = myAttendance?.status === 'waitlist'

  const handleToggle = useMutation({
    mutationFn: async () => {
      const batch = writeBatch(db)

      if (myAttendance) {
        // Sair da lista
        batch.delete(doc(db, 'attendances', myAttendance.id))

        // Se saiu da confirmada e tem alguém na espera, promove o primeiro
        if (myAttendance.status === 'confirmed' && waitlist.length > 0) {
          const next = waitlist[0]
          batch.update(doc(db, 'attendances', next.id), { status: 'confirmed' })
          if (next.player_type === 'avulso') {
            const payRef = doc(collection(db, 'payments'))
            batch.set(payRef, {
              user_id: next.user_id,
              amount: 22,
              type: 'jogo',
              game_id: gameId,
              month: gameId,
              paid: false,
              created_at: new Date().toISOString()
            })
          }
        }
      } else {
        // Entrar na lista
        const playerType = user!.player_type ?? 'avulso'
        const status: 'confirmed' | 'waitlist' =
          isFull || (playerType === 'avulso' && priorityOpen) ? 'waitlist' : 'confirmed'

        const attRef = doc(collection(db, 'attendances'))
        batch.set(attRef, {
          game_id: gameId,
          user_id: user!.id,
          player_type: playerType,
          status,
          confirmed_at: new Date().toISOString()
        })

        // Avulso confirmado direto gera pagamento
        if (status === 'confirmed' && playerType === 'avulso') {
          const payRef = doc(collection(db, 'payments'))
          batch.set(payRef, {
            user_id: user!.id,
            amount: 22,
            type: 'jogo',
            game_id: gameId,
            month: gameId,
            paid: false,
            created_at: new Date().toISOString()
          })
        }
      }

      await batch.commit()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendances', gameId] })
      qc.invalidateQueries({ queryKey: ['payments'] })
      if (myAttendance) {
        toast.success('Saiu da lista')
      } else {
        const playerType = user!.player_type ?? 'avulso'
        if (isFull || (playerType === 'avulso' && priorityOpen)) {
          toast('Na lista de espera ⏳', { description: 'Você será confirmado quando houver vaga.' })
        } else {
          toast.success('Presença confirmada! 🙌')
        }
      }
    },
    onError: () => toast.error('Erro ao atualizar presença')
  })

  return (
    <div className="flex flex-col min-h-full pb-24 px-4">

      {/* Cabeçalho */}
      <div className="pt-8 pb-2">
        <p className="text-sm font-medium uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
          Próxima pelada
        </p>
        <h1 className="text-4xl font-bold text-white mt-1">Quarta-feira</h1>
        <p className="text-lg mt-0.5" style={{ color: 'var(--text-muted)' }}>{gameDateStr}</p>
      </div>

      {/* Info */}
      <div className="flex gap-5 mt-4">
        <div className="flex items-center gap-2">
          <Clock size={15} style={{ color: 'var(--green)' }} />
          <span className="text-white font-semibold">21:30</span>
        </div>
        <div className="flex items-center gap-2">
          <MapPin size={15} style={{ color: 'var(--green)' }} />
          <span className="text-white font-semibold">9e10</span>
        </div>
      </div>

      {/* Barra de vagas */}
      <div className="mt-6">
        <div className="flex justify-between items-baseline mb-2">
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Confirmados</span>
          <span className="font-bold text-white text-xl">
            {confirmed.length}
            <span className="font-normal text-sm" style={{ color: 'var(--text-muted)' }}>/{MAX_PLAYERS}</span>
          </span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface2)' }}>
          <div className="h-full rounded-full transition-all"
            style={{
              width: `${Math.min((confirmed.length / MAX_PLAYERS) * 100, 100)}%`,
              background: isFull ? '#ef4444' : 'var(--green)'
            }} />
        </div>
      </div>

      {/* Aviso prazo */}
      {priorityOpen && (
        <div className="mt-4 px-4 py-3 rounded-xl flex items-start gap-2"
          style={{ background: '#92400e22', border: '1px solid #92400e66' }}>
          <Clock3 size={14} style={{ color: '#fbbf24', marginTop: 1, flexShrink: 0 }} />
          <span className="text-sm" style={{ color: '#fbbf24' }}>
            Prioridade mensalistas até <strong>{deadlineStr}</strong>
          </span>
        </div>
      )}

      {/* Botão */}
      <button
        onClick={() => handleToggle.mutate()}
        disabled={handleToggle.isPending}
        className="w-full mt-5 py-4 rounded-2xl font-semibold text-white text-base transition-all active:scale-95 disabled:opacity-40 flex items-center justify-center gap-2"
        style={{ background: myAttendance ? '#7f1d1d' : 'var(--green)' }}
      >
        {handleToggle.isPending ? 'Aguarde...'
          : myAttendance ? <><XCircle size={18} />Sair da lista</>
          : <><CheckCircle2 size={18} />Confirmar presença</>}
      </button>

      {amConfirmed && (
        <p className="text-center text-sm mt-2" style={{ color: 'var(--green)' }}>✓ Você está confirmado</p>
      )}
      {amInWaitlist && (
        <p className="text-center text-sm mt-2" style={{ color: '#fbbf24' }}>⏳ Você está na lista de espera</p>
      )}

      {/* Listas */}
      {isLoading ? (
        <div className="flex justify-center mt-8"><div className="text-3xl animate-spin">⚽</div></div>
      ) : (
        <div className="mt-8 space-y-5">
          {confirmedMensalistas.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-2">
                <Crown size={12} style={{ color: '#fbbf24' }} />
                <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  Mensalistas ({confirmedMensalistas.length})
                </h2>
              </div>
              <div className="space-y-2">
                {confirmedMensalistas.map((a, i) => (
                  <PlayerRow key={a.id} attendance={a} index={i + 1} isMe={a.user_id === user?.id} />
                ))}
              </div>
            </section>
          )}

          {confirmedAvulsos.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                Avulsos ({confirmedAvulsos.length})
              </h2>
              <div className="space-y-2">
                {confirmedAvulsos.map((a, i) => (
                  <PlayerRow key={a.id} attendance={a} index={confirmedMensalistas.length + i + 1} isMe={a.user_id === user?.id} />
                ))}
              </div>
            </section>
          )}

          {confirmed.length === 0 && (
            <p className="text-sm py-4 text-center" style={{ color: 'var(--text-muted)' }}>
              Ninguém confirmado ainda 🙋
            </p>
          )}

          {waitlist.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                Lista de espera ({waitlist.length})
              </h2>
              <div className="space-y-2">
                {waitlist.map((a, i) => (
                  <PlayerRow key={a.id} attendance={a} index={i + 1} isMe={a.user_id === user?.id} waitlist />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

function PlayerRow({ attendance, index, isMe, waitlist = false }: {
  attendance: Attendance
  index: number
  isMe: boolean
  waitlist?: boolean
}) {
  const name = (attendance.profile as any)?.name || (attendance.profile as any)?.email || 'Jogador'
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
      style={{
        background: 'var(--surface)',
        border: `1px solid ${isMe ? 'var(--green)' : 'var(--border)'}`,
        opacity: waitlist ? 0.7 : 1
      }}>
      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
        style={{ background: 'var(--surface2)', color: waitlist ? 'var(--text-muted)' : 'var(--green)' }}>
        {waitlist ? '⏳' : index}
      </div>
      <p className="text-sm font-medium text-white truncate flex-1">
        {name}
        {isMe && <span className="ml-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>(você)</span>}
      </p>
      {attendance.player_type === 'avulso' && !waitlist && (
        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#1e3a2e', color: '#4ade80' }}>
          R$22
        </span>
      )}
    </div>
  )
}

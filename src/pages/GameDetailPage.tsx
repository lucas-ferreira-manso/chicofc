import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, Link } from 'react-router-dom'
import {
  doc, getDoc, collection, getDocs, query, where,
  addDoc, deleteDoc, updateDoc, writeBatch
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuthStore } from '../store/authStore'
import { format, isAfter } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ArrowLeft, MapPin, Clock, CheckCircle2, XCircle, Clock3, Crown } from 'lucide-react'
import { toast } from 'sonner'
import type { Game, Attendance, Profile } from '../types'

const MAX_PLAYERS = 14
const LOCATION = '9e10'
const TIME = '21:30'

// Prazo de prioridade: terça-feira às 13:00 antes do jogo
function getPriorityDeadline(gameDate: string): Date {
  const game = new Date(gameDate)
  // Volta para terça (game é quarta = dia 3, terça = dia 2)
  const tuesday = new Date(game)
  tuesday.setDate(game.getDate() - 1)
  tuesday.setHours(13, 0, 0, 0)
  return tuesday
}

function isPriorityWindowOpen(gameDate: string): boolean {
  return !isAfter(new Date(), getPriorityDeadline(gameDate))
}

async function fetchGame(id: string): Promise<Game> {
  const snap = await getDoc(doc(db, 'games', id))
  return { id: snap.id, ...snap.data() } as Game
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

export default function GameDetailPage() {
  const { id } = useParams<{ id: string }>()
  const user = useAuthStore(s => s.user)
  const qc = useQueryClient()

  const { data: game, isLoading } = useQuery({
    queryKey: ['game', id],
    queryFn: () => fetchGame(id!)
  })

  const { data: attendances = [] } = useQuery({
    queryKey: ['attendances', id],
    queryFn: () => fetchAttendances(id!)
  })

  const myAttendance = attendances.find(a => a.user_id === user?.id)

  // Separar confirmados e lista de espera
  const confirmed = attendances.filter(a => a.status === 'confirmed')
  const waitlist = attendances.filter(a => a.status === 'waitlist')

  // Dentro dos confirmados, separar por tipo
  const confirmedMensalistas = confirmed.filter(a => a.player_type === 'mensalista')
  const confirmedAvulsos = confirmed.filter(a => a.player_type === 'avulso')

  const isFull = confirmed.length >= MAX_PLAYERS
  const priorityOpen = game ? isPriorityWindowOpen(game.date) : true

  const handleToggle = useMutation({
    mutationFn: async () => {
      if (myAttendance) {
        // Sair da lista
        await deleteDoc(doc(db, 'attendances', myAttendance.id))

        // Se saiu da lista confirmada e tem gente na espera, promover o primeiro
        if (myAttendance.status === 'confirmed' && waitlist.length > 0) {
          const next = waitlist[0]
          const batch = writeBatch(db)
          batch.update(doc(db, 'attendances', next.id), { status: 'confirmed' })

          // Se é avulso sendo promovido, gerar pagamento pendente
          if (next.player_type === 'avulso') {
            const payRef = doc(collection(db, 'payments'))
            batch.set(payRef, {
              user_id: next.user_id,
              amount: 22,
              type: 'jogo',
              game_id: id,
              month: id, // usa game_id como chave única do mês para avulsos
              paid: false,
              created_at: new Date().toISOString()
            })
          }
          await batch.commit()
        }
      } else {
        // Entrar na lista
        const playerType = user!.player_type ?? 'avulso'
        let status: 'confirmed' | 'waitlist' = 'confirmed'

        if (isFull) {
          // Lista cheia — vai para espera
          status = 'waitlist'
        } else if (playerType === 'avulso' && priorityOpen) {
          // Janela de prioridade ainda aberta — avulso vai para espera
          status = 'waitlist'
        }

        const batch = writeBatch(db)
        const attRef = doc(collection(db, 'attendances'))
        batch.set(attRef, {
          game_id: id,
          user_id: user!.id,
          player_type: playerType,
          status,
          confirmed_at: new Date().toISOString()
        })

        // Se avulso entrou direto na lista confirmada (fora da janela, vaga aberta), gera pagamento
        if (status === 'confirmed' && playerType === 'avulso') {
          const payRef = doc(collection(db, 'payments'))
          batch.set(payRef, {
            user_id: user!.id,
            amount: 22,
            type: 'jogo',
            game_id: id,
            month: id,
            paid: false,
            created_at: new Date().toISOString()
          })
        }

        await batch.commit()
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendances', id] })
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

  if (isLoading || !game) return (
    <div className="flex-1 flex items-center justify-center min-h-dvh">
      <div className="text-4xl animate-spin">⚽</div>
    </div>
  )

  const deadline = getPriorityDeadline(game.date)
  const deadlineStr = format(deadline, "EEE dd/MM 'às' HH'h'mm", { locale: ptBR })

  const amInWaitlist = myAttendance?.status === 'waitlist'
  const amConfirmed = myAttendance?.status === 'confirmed'

  return (
    <div className="flex flex-col min-h-full pb-24">
      {/* Header */}
      <div className="px-4 pt-5 pb-2">
        <Link to="/games" className="flex items-center gap-1 text-sm" style={{ color: 'var(--text-muted)' }}>
          <ArrowLeft size={16} /> Peladas
        </Link>
      </div>

      {/* Info fixa do jogo */}
      <div className="px-4 pb-5">
        <h1 className="text-2xl font-bold text-white mt-2">Quarta-feira</h1>
        <div className="flex gap-4 mt-3">
          <div className="flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
            <Clock size={14} />
            <span className="text-sm font-medium text-white">{TIME}</span>
          </div>
          <div className="flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
            <MapPin size={14} />
            <span className="text-sm font-medium text-white">{LOCATION}</span>
          </div>
        </div>

        {/* Barra de progresso */}
        <div className="mt-5">
          <div className="flex justify-between text-sm mb-2">
            <span style={{ color: 'var(--text-muted)' }}>Confirmados</span>
            <span className="font-bold text-white" style={{ fontSize: '1.1rem' }}>
              {confirmed.length}
              <span className="font-normal text-sm" style={{ color: 'var(--text-muted)' }}>/{MAX_PLAYERS}</span>
            </span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface2)' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min((confirmed.length / MAX_PLAYERS) * 100, 100)}%`,
                background: isFull ? '#ef4444' : 'var(--green)'
              }}
            />
          </div>
        </div>

        {/* Aviso de prazo */}
        {priorityOpen && game.status === 'upcoming' && (
          <div className="mt-4 px-4 py-3 rounded-xl text-sm flex items-start gap-2"
            style={{ background: '#92400e22', border: '1px solid #92400e66' }}>
            <Clock3 size={15} style={{ color: '#fbbf24', marginTop: 1, flexShrink: 0 }} />
            <span style={{ color: '#fbbf24' }}>
              Prioridade para mensalistas até <strong>{deadlineStr}</strong>. Avulsos ficam na espera até lá.
            </span>
          </div>
        )}

        {/* Botão de ação */}
        {game.status === 'upcoming' && (
          <button
            onClick={() => handleToggle.mutate()}
            disabled={handleToggle.isPending}
            className="w-full mt-4 py-3.5 rounded-2xl font-semibold text-white transition-all active:scale-95 disabled:opacity-40 flex items-center justify-center gap-2"
            style={{
              background: myAttendance
                ? '#7f1d1d'
                : amInWaitlist
                  ? '#78350f'
                  : 'var(--green)'
            }}
          >
            {handleToggle.isPending ? (
              <span>Aguarde...</span>
            ) : myAttendance ? (
              <><XCircle size={18} />Sair da lista</>
            ) : (
              <><CheckCircle2 size={18} />Confirmar presença</>
            )}
          </button>
        )}

        {/* Status do usuário */}
        {amConfirmed && (
          <p className="text-center text-sm mt-2" style={{ color: 'var(--green)' }}>✓ Você está confirmado</p>
        )}
        {amInWaitlist && (
          <p className="text-center text-sm mt-2" style={{ color: '#fbbf24' }}>⏳ Você está na lista de espera</p>
        )}
      </div>

      {/* Lista de confirmados */}
      <div className="px-4 space-y-5">
        {/* Mensalistas confirmados */}
        {confirmedMensalistas.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-2">
              <Crown size={13} style={{ color: '#fbbf24' }} />
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

        {/* Avulsos confirmados */}
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
          <p className="text-sm py-4 text-center" style={{ color: 'var(--text-muted)' }}>Ninguém confirmado ainda 🙋</p>
        )}

        {/* Lista de espera */}
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
    </div>
  )
}

function PlayerRow({
  attendance, index, isMe, waitlist = false
}: {
  attendance: Attendance
  index: number
  isMe: boolean
  waitlist?: boolean
}) {
  const name = (attendance.profile as any)?.name || (attendance.profile as any)?.email || 'Jogador'
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-xl"
      style={{
        background: 'var(--surface)',
        border: `1px solid ${isMe ? 'var(--green)' : 'var(--border)'}`,
        opacity: waitlist ? 0.7 : 1
      }}
    >
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
        style={{ background: 'var(--surface2)', color: waitlist ? 'var(--text-muted)' : 'var(--green)' }}
      >
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

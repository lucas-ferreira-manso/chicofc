import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { collection, getDocs, query, where, doc, setDoc, getDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuthStore } from '../store/authStore'
import { useNavigate } from 'react-router-dom'
import { CaretLeft } from '@phosphor-icons/react'
import { format, isWednesday, nextWednesday, startOfDay } from 'date-fns'
import { toast } from 'sonner'
import type { Attendance, Profile } from '../types'

const MIN_PLAYERS = 6
const MAX_PLAYERS = 7

function getNextWednesdayId(): string {
  const today = startOfDay(new Date())
  const wed = isWednesday(today) ? today : nextWednesday(today)
  return format(wed, 'yyyy-MM-dd')
}

async function fetchConfirmed(gameId: string): Promise<Profile[]> {
  const q = query(collection(db, 'attendances'), where('game_id', '==', gameId), where('status', '==', 'confirmed'))
  const snap = await getDocs(q)
  const profiles: Profile[] = []
  for (const d of snap.docs) {
    const pid = d.data().user_id
    const pSnap = await getDoc(doc(db, 'players', pid))
    if (pSnap.exists()) profiles.push({ id: pSnap.id, ...pSnap.data() } as Profile)
  }
  return profiles
}

async function fetchLineup(gameId: string) {
  const snap = await getDoc(doc(db, 'lineups', gameId))
  if (!snap.exists()) return { blue: [] as string[], black: [] as string[] }
  return snap.data() as { blue: string[]; black: string[] }
}

export default function EscalacaoPage() {
  const navigate = useNavigate()
  const user = useAuthStore(s => s.user)
  const qc = useQueryClient()
  const gameId = getNextWednesdayId()
  const [activeTeam, setActiveTeam] = useState<'blue' | 'black'>('blue')
  const [blueIds, setBlueIds] = useState<string[]>([])
  const [blackIds, setBlackIds] = useState<string[]>([])
  const [loaded, setLoaded] = useState(false)

  const { data: players = [] } = useQuery({
    queryKey: ['confirmed', gameId],
    queryFn: () => fetchConfirmed(gameId)
  })

  useQuery({
    queryKey: ['lineup', gameId],
    queryFn: () => fetchLineup(gameId),
    enabled: !loaded,
    onSuccess: (data: { blue: string[]; black: string[] }) => {
      setBlueIds(data.blue)
      setBlackIds(data.black)
      setLoaded(true)
    }
  } as any)

  const activeIds = activeTeam === 'blue' ? blueIds : blackIds
  const setActiveIds = (ids: string[]) => activeTeam === 'blue' ? setBlueIds(ids) : setBlackIds(ids)

  const togglePlayer = (id: string) => {
    const otherIds = activeTeam === 'blue' ? blackIds : blueIds
    if (otherIds.includes(id)) {
      toast('Jogador já está no outro time')
      return
    }
    if (activeIds.includes(id)) {
      setActiveIds(activeIds.filter(i => i !== id))
    } else {
      if (activeIds.length >= MAX_PLAYERS) {
        toast(`Máximo de ${MAX_PLAYERS} jogadores por time`)
        return
      }
      setActiveIds([...activeIds, id])
    }
  }

  const canSave = blueIds.length >= MIN_PLAYERS && blackIds.length >= MIN_PLAYERS

  const saveLineup = useMutation({
    mutationFn: async () => {
      await setDoc(doc(db, 'lineups', gameId), {
        blue: blueIds,
        black: blackIds,
        updatedAt: new Date().toISOString()
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lineup', gameId] })
      toast.success('Times salvos!')
      navigate('/games')
    },
    onError: () => toast.error('Erro ao salvar times')
  })

  return (
    <div className="flex flex-col min-h-full pb-32" style={{ background: 'var(--color-bg)' }}>

      {/* Header */}
      <div className="px-6 pt-12 pb-4 flex items-center gap-3"
        style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
        <button onClick={() => navigate('/games')} className="shrink-0">
          <CaretLeft size={24} color="var(--color-fg-primary)" />
        </button>
        <p style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-24)', fontWeight: 600, lineHeight: '28px' }}>
          Escalar times
        </p>
      </div>

      {/* Tabs */}
      <div className="px-6 pt-4 pb-2">
        <div className="flex gap-3 p-2 rounded-[20px]" style={{ background: 'var(--color-surface-secondary)' }}>
          {([['blue', 'Time Azul', '/team-blue.png'], ['black', 'Time Preto', '/team-yellow.png']] as const).map(([team, label, img]) => {
            const isActive = activeTeam === team
            return (
              <button key={team} onClick={() => setActiveTeam(team)}
                className="flex-1 flex items-center gap-2 px-4 py-2 rounded-2xl transition-all"
                style={{ background: isActive ? 'var(--color-surface-white)' : 'transparent', justifyContent: team === 'black' ? 'flex-end' : 'flex-start' }}>
                <img src={img} alt={label} width={24} height={24} style={{ objectFit: 'contain' }} />
                <span style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)', fontWeight: 500 }}>{label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Counter */}
      <div className="px-6 py-2">
        <p style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)', fontWeight: 500 }}>
          {activeIds.length} escalados
          <span style={{ color: 'var(--color-fg-secondary)', fontSize: 'var(--font-size-14)' }}> · mín {MIN_PLAYERS}, máx {MAX_PLAYERS}</span>
        </p>
      </div>

      {/* Lista de jogadores */}
      <div className="px-6 flex flex-col gap-2 pb-4">
        {players.map(p => {
          const isSelected = activeIds.includes(p.id)
          const inOtherTeam = (activeTeam === 'blue' ? blackIds : blueIds).includes(p.id)
          return (
            <button key={p.id} onClick={() => togglePlayer(p.id)} disabled={inOtherTeam}
              className="w-full flex items-center gap-3 px-6 py-4 rounded-3xl transition-all active:scale-[0.99]"
              style={{
                background: isSelected ? 'var(--color-surface-accent-light)' : 'var(--color-surface-primary)',
                border: isSelected ? '1.5px solid var(--color-fg-accent-light)' : '1.5px solid transparent',
                opacity: inOtherTeam ? 0.4 : 1
              }}>
              <div className="flex-1 text-left">
                <p style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-14)', fontWeight: 500 }}>
                  {p.name || p.email}
                </p>
              </div>
              {/* Radio */}
              <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all"
                style={{ borderColor: isSelected ? 'var(--color-fg-accent-light)' : 'var(--color-fg-secondary)', background: isSelected ? 'var(--color-fg-accent-light)' : 'transparent' }}>
                {isSelected && <div className="w-2 h-2 rounded-full" style={{ background: 'white' }} />}
              </div>
            </button>
          )
        })}
      </div>

      {/* Botão salvar */}
      <div className="fixed inset-x-0 px-6 pt-4 pb-8"
        style={{ bottom: 0, background: 'var(--color-bg)', borderTop: '1px solid var(--color-border)' }}>
        <button onClick={() => saveLineup.mutate()} disabled={!canSave || saveLineup.isPending}
          className="w-full py-4 font-medium transition-all active:scale-95 disabled:opacity-40"
          style={{
            background: canSave ? 'var(--btn-primary-bg)' : 'var(--color-surface-secondary)',
            color: canSave ? 'var(--btn-primary-fg)' : 'var(--color-fg-secondary)',
            borderRadius: 'var(--radius-pill)',
            fontFamily: 'var(--font-primary)',
            fontSize: 'var(--font-size-16)',
            fontWeight: 500
          }}>
          {saveLineup.isPending ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </div>
  )
}

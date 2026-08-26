import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { collection, getDocs, query, where, doc, setDoc, getDoc, addDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuthStore } from '../store/authStore'
import { useNavigate } from 'react-router-dom'
import { CaretLeft, ShareNetwork, X } from '@phosphor-icons/react'
import { useRef } from 'react'
import { format, isWednesday, nextWednesday, startOfDay, isAfter } from 'date-fns'
import { toast } from 'sonner'
import type { Profile } from '../types'

const MIN_PLAYERS = 6
const MAX_PLAYERS = 8

function getNextWednesdayDate(): Date {
  const today = startOfDay(new Date())
  return isWednesday(today) ? today : nextWednesday(today)
}

function getNextWednesdayId(): string {
  return format(getNextWednesdayDate(), 'yyyy-MM-dd')
}

// Mesma janela do avulso temporário na Lista de Presença — terça 16h até quarta 21h20
function getTuesdayAt16h(gameDate: Date): Date {
  const tuesday = new Date(gameDate)
  tuesday.setDate(gameDate.getDate() - 1)
  tuesday.setHours(16, 0, 0, 0)
  return tuesday
}

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

async function fetchConfirmed(gameId: string): Promise<Profile[]> {
  const q = query(collection(db, 'attendances'), where('game_id', '==', gameId), where('status', '==', 'confirmed'))
  const snap = await getDocs(q)
  const profiles: Profile[] = []
  for (const d of snap.docs) {
    const pid = d.data().user_id
    const pSnap = await getDoc(doc(db, 'players', pid))
    if (pSnap.exists()) profiles.push({ id: pSnap.id, ...pSnap.data() } as Profile)
  }

  // Inclui avulsos temporários adicionados para este jogo
  const tempSnap = await getDocs(query(collection(db, 'avulsos_temp'), where('gameId', '==', gameId)))
  for (const d of tempSnap.docs) {
    const data = d.data()
    profiles.push({
      id: `temp_${d.id}`,
      name: data.name ?? 'Avulso',
      email: '',
      player_type: 'avulso',
      role: 'player',
      active: true,
      created_at: data.createdAt ?? new Date().toISOString(),
    } as Profile)
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
  const gameDate = getNextWednesdayDate()
  const gameId = getNextWednesdayId()
  const isAdmin = user?.role === 'admin'
  const [activeTeam, setActiveTeam] = useState<'blue' | 'black'>('blue')
  const [blueIds, setBlueIds] = useState<string[]>([])
  const [blackIds, setBlackIds] = useState<string[]>([])
  const [loaded, setLoaded] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [showAvulsoSheet, setShowAvulsoSheet] = useState(false)
  const [avulsoName, setAvulsoName] = useState('')
  const shareCardRef = useRef<HTMLDivElement>(null)

  const { data: players = [] } = useQuery({
    queryKey: ['confirmed', gameId],
    queryFn: () => fetchConfirmed(gameId),
    refetchInterval: 15000
  })

  const { data: existingLineup } = useQuery({
    queryKey: ['lineup', gameId],
    queryFn: () => fetchLineup(gameId),
  })

  if (existingLineup && !loaded) {
    setBlueIds(existingLineup.blue || [])
    setBlackIds(existingLineup.black || [])
    setLoaded(true)
  }

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

  const unassignedCount = players.length - blueIds.length - blackIds.length
  const allAssigned = unassignedCount <= 0
  const canSave = isAdmin && blueIds.length >= MIN_PLAYERS && blackIds.length >= MIN_PLAYERS && allAssigned
  const avulsoWindowOpen = shouldShowAvulsoButton(gameDate, players.length)

  const addAvulso = useMutation({
    mutationFn: async () => {
      const userName = (user as any)?.name || (user as any)?.email || 'Usuário'
      await addDoc(collection(db, 'avulsos_temp'), {
        name: avulsoName.trim(),
        addedBy: user!.id,
        addedByName: userName,
        gameId,
        createdAt: new Date().toISOString()
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['confirmed', gameId] })
      setAvulsoName('')
      setShowAvulsoSheet(false)
      toast.success('Avulso temporário adicionado! Já dá pra escalar.')
    },
    onError: () => toast.error('Erro ao adicionar avulso')
  })

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

  const handleShare = async () => {
    if (!shareCardRef.current) return
    setSharing(true)
    try {
      const html2canvas = (await import('html2canvas')).default
      const root = document.documentElement
      const getVar = (v: string) => getComputedStyle(root).getPropertyValue(v).trim()
      const canvas = await html2canvas(shareCardRef.current, {
        backgroundColor: getVar('--color-bg') || '#ffffff',
        scale: 2,
        useCORS: true,
        logging: false,
        onclone: (_doc, el) => {
          const vars: Record<string, string> = {
            '--color-bg': getVar('--color-bg'),
            '--color-fg-primary': getVar('--color-fg-primary'),
            '--color-fg-secondary': getVar('--color-fg-secondary'),
            '--color-surface-primary': getVar('--color-surface-primary'),
            '--font-primary': getVar('--font-primary'),
          }
          Object.entries(vars).forEach(([k, v]) => el.style.setProperty(k, v))
        }
      })
      canvas.toBlob(async (blob) => {
        if (!blob) return
        const file = new File([blob], 'escalacao-chicofc.png', { type: 'image/png' })
        if (navigator.share && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: 'Escalação ChicoFC ⚽' })
        } else {
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = 'escalacao-chicofc.png'
          a.click()
          URL.revokeObjectURL(url)
          toast.success('Imagem salva!')
        }
      }, 'image/png')
    } catch (e) {
      console.error('[handleShare] erro:', e)
      toast.error('Erro ao gerar imagem')
    } finally {
      setSharing(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen" style={{ background: 'var(--color-bg)', paddingBottom: 'calc(120px + env(safe-area-inset-bottom))' }}>

      {/* Header */}
      <div className="px-6 pt-12 pb-4 flex items-center gap-3"
        style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
        <button onClick={() => navigate('/games')} className="shrink-0">
          <CaretLeft size={24} color="var(--color-fg-primary)" />
        </button>
        <p style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-24)', fontWeight: 600, lineHeight: '28px', flex: 1 }}>
          {isAdmin ? 'Escalar times' : 'Times escalados'}
        </p>
        {canSave && (
          <button onClick={handleShare} disabled={sharing}
            className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full transition-all active:scale-95"
            style={{ background: 'var(--color-surface-primary)' }}>
            {sharing
              ? <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--color-fg-accent)' }} />
              : <ShareNetwork size={20} color="var(--color-fg-primary)" />}
          </button>
        )}
      </div>

      {/* Card compartilhável oculto */}
      <div ref={shareCardRef} style={{ position: 'absolute', left: '-9999px', top: 0, width: 390, padding: '24px', background: 'var(--color-bg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <img src="/logo.png" alt="ChicoFC" width={32} height={32} style={{ borderRadius: 8 }} />
          <p style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 20, fontWeight: 700 }}>ChicoFC ⚽</p>
        </div>
        {(['blue', 'black'] as const).map(team => {
          const ids = team === 'blue' ? blueIds : blackIds
          const label = team === 'blue' ? 'Time Azul' : 'Time Preto'
          const img = team === 'blue' ? '/team-blue.png' : '/team-yellow.png'
          return (
            <div key={team} style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <img src={img} alt={label} width={20} height={20} />
                <p style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 14, fontWeight: 600 }}>{label}</p>
              </div>
              {ids.map((uid, i) => {
                const p = players.find(pl => pl.id === uid)
                const name = p?.name || p?.email || uid
                return (
                  <div key={uid} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', marginBottom: 4, borderRadius: 12, background: 'var(--color-surface-primary)' }}>
                    <span style={{ color: 'var(--color-fg-secondary)', fontFamily: 'var(--font-primary)', fontSize: 13, width: 18 }}>{i + 1}</span>
                    <span style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 14, fontWeight: 500 }}>{name}</span>
                  </div>
                )
              })}
            </div>
          )
        })}
        <p style={{ color: 'var(--color-fg-secondary)', fontFamily: 'var(--font-primary)', fontSize: 11, textAlign: 'center', marginTop: 12 }}>chicofc.vercel.app</p>
      </div>

      {/* Tabs */}
      <div className="px-6 pt-4 pb-2">
        <div className="flex gap-3 p-2 rounded-[20px]" style={{ background: 'var(--color-surface-secondary)' }}>
          {([['blue', 'Time Azul', '/team-blue.png'], ['black', 'Time Preto', '/team-yellow.png']] as const).map(([team, label, img]) => {
            const isActive = activeTeam === team
            return (
              <button key={team} onClick={() => setActiveTeam(team)}
                className="flex-1 flex items-center gap-2 px-4 py-2 rounded-2xl transition-all"
                style={{ background: isActive ? 'var(--color-tab-selected-bg)' : 'transparent', justifyContent: team === 'black' ? 'flex-end' : 'flex-start' }}>
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
        {isAdmin && unassignedCount > 0 && (
          <p className="mt-1" style={{ color: 'var(--color-danger)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-14)', fontWeight: 500 }}>
            {unassignedCount} confirmado{unassignedCount > 1 ? 's' : ''} ainda sem time — escale todos para salvar
          </p>
        )}
      </div>

      {/* Lista de jogadores */}
      <div className="px-6 flex flex-col gap-2 pb-4">
        {players.map(p => {
          const isSelected = activeIds.includes(p.id)
          const inOtherTeam = (activeTeam === 'blue' ? blackIds : blueIds).includes(p.id)
          const name = p.name || p.email || 'Jogador'
          const photoURL = (p as any).photoURL

          return (
            <button key={p.id} onClick={() => togglePlayer(p.id)} disabled={inOtherTeam}
              className="w-full flex items-center gap-3 px-4 py-4 rounded-3xl transition-all active:scale-[0.99]"
              style={{
                background: isSelected ? 'var(--color-surface-accent-light)' : 'var(--color-surface-primary)',
                border: isSelected ? '1.5px solid var(--color-fg-accent-light)' : '1.5px solid transparent',
                opacity: inOtherTeam ? 0.4 : 1,
                cursor: isAdmin ? 'pointer' : 'default'
              }}>

              <Avatar name={name} photoURL={photoURL} bgSelected={isSelected} />

              <p className="flex-1 text-left" style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)', fontWeight: 500 }}>
                {name}
              </p>

              {/* Radio — só para admin */}
              {isAdmin && (
                <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all"
                  style={{
                    borderColor: isSelected ? 'var(--color-fg-accent-light)' : 'var(--color-fg-secondary)',
                    background: isSelected ? 'var(--color-fg-accent-light)' : 'transparent'
                  }}>
                  {isSelected && <div className="w-2 h-2 rounded-full" style={{ background: 'white' }} />}
                </div>
              )}
            </button>
          )
        })}

        {isAdmin && avulsoWindowOpen && (
          <button onClick={() => setShowAvulsoSheet(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-4 rounded-3xl transition-all active:scale-[0.99]"
            style={{
              background: 'var(--btn-secondary-bg)', color: 'var(--btn-secondary-fg)',
              border: '1.5px dashed var(--btn-secondary-fg)',
              fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)', fontWeight: 500
            }}>
            + Adicionar Avulso Temporário
          </button>
        )}
      </div>

      {/* Botão salvar — só admin */}
      {isAdmin && (
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
      )}

      {/* Bottom sheet — Avulso Temporário */}
      {showAvulsoSheet && (
        <>
          <div onClick={() => { setShowAvulsoSheet(false); setAvulsoName('') }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 60 }} />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 70,
            background: 'var(--color-bg)', borderRadius: '24px 24px 0 0',
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

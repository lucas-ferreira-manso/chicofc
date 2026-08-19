import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLockBodyScroll } from '../lib/useLockBodyScroll'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CaretLeft, Plus, TrashSimple } from '@phosphor-icons/react'
import { db } from '../lib/firebase'
import { useAuthStore } from '../store/authStore'
import { toast } from 'sonner'
import { fetchGameCancellation } from '../lib/gameStatus'
import { getLastWednesdayId } from '../components/stats/VotacaoComponents'

interface GameEntry { blue: number; yellow: number; date: string }
interface ScoreData { blueWins: number; yellowWins: number; updatedAt: string; history: GameEntry[] }
const EMPTY_SCORE: ScoreData = { blueWins: 0, yellowWins: 0, updatedAt: '', history: [] }

async function fetchScore(): Promise<ScoreData> {
  const snap = await getDoc(doc(db, 'config', 'score'))
  if (!snap.exists()) return EMPTY_SCORE
  const d = snap.data()
  return { blueWins: d.blueWins ?? 0, yellowWins: d.yellowWins ?? 0, updatedAt: d.updatedAt ?? '', history: d.history ?? [] }
}

export default function StatsPlacasrPage() {
  const user = useAuthStore(s => s.user)
  const isAdmin = user?.role === 'admin'
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [showSheet, setShowSheet] = useState(false)
  useLockBodyScroll(showSheet)
  const [blueGoals, setBlueGoals] = useState('')
  const [yellowGoals, setYellowGoals] = useState('')

  const { data: score, isLoading } = useQuery({ queryKey: ['score'], queryFn: fetchScore })
  const currentGameId = getLastWednesdayId()
  const { data: gameCancel } = useQuery({ queryKey: ['game-cancel', currentGameId], queryFn: () => fetchGameCancellation(currentGameId), refetchInterval: 30_000 })
  const isCancelled = !!gameCancel?.cancelled

  const saveScore = useMutation({
    mutationFn: async () => {
      const blue = parseInt(blueGoals) || 0
      const yellow = parseInt(yellowGoals) || 0
      const now = new Date().toISOString()
      const current = score ?? EMPTY_SCORE
      await setDoc(doc(db, 'config', 'score'), {
        blueWins: current.blueWins + (blue > yellow ? 1 : 0),
        yellowWins: current.yellowWins + (yellow > blue ? 1 : 0),
        updatedAt: now,
        history: [...current.history, { blue, yellow, date: now }]
      })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['score'] }); toast.success('Placar salvo!'); setShowSheet(false); setBlueGoals(''); setYellowGoals('') },
    onError: () => toast.error('Erro ao salvar placar')
  })

  const deleteEntry = useMutation({
    mutationFn: async (idx: number) => {
      const current = score ?? EMPTY_SCORE
      const newHistory = current.history.filter((_, i) => i !== idx)
      await setDoc(doc(db, 'config', 'score'), { ...current, blueWins: newHistory.filter(e => e.blue > e.yellow).length, yellowWins: newHistory.filter(e => e.yellow > e.blue).length, history: newHistory, updatedAt: new Date().toISOString() })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['score'] }); toast.success('Jogo removido!') },
    onError: () => toast.error('Erro ao remover jogo')
  })

  const blueWins = score?.blueWins ?? 0
  const yellowWins = score?.yellowWins ?? 0
  const history = score?.history ?? []
  const updatedStr = score?.updatedAt ? format(new Date(score.updatedAt), "d 'de' MMMM 'às' HH'h'mm", { locale: ptBR }) : null

  const inputStyle: React.CSSProperties = {
    width: 80, height: 80, borderRadius: 20, textAlign: 'center',
    fontFamily: 'var(--font-primary)', fontWeight: 700, fontSize: 32,
    background: 'var(--color-surface-primary)', border: '2px solid var(--color-border)',
    color: 'var(--color-fg-primary)', outline: 'none'
  }

  return (
    <div className="flex flex-col min-h-screen" style={{ background: 'var(--color-bg)', paddingBottom: 'calc(120px + env(safe-area-inset-bottom))' }}>
      {/* Header */}
      <div className="fixed top-0 inset-x-0 z-40" style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 24px 12px' }}>
          <button onClick={() => navigate('/stats')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', marginLeft: -4 }}>
            <CaretLeft size={24} color="var(--color-fg-primary)" weight="bold" />
          </button>
          <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 600, fontSize: 24, color: 'var(--color-fg-primary)', flex: 1, lineHeight: '28px' }}>Placar Geral</p>
          {isAdmin && !isCancelled && (
            <button onClick={() => setShowSheet(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}>
              <Plus size={24} color="var(--color-fg-primary)" weight="bold" />
            </button>
          )}
        </div>
        {updatedStr && (
          <p style={{ fontFamily: 'var(--font-primary)', fontSize: 13, color: 'var(--color-fg-secondary)', padding: '0 24px 10px' }}>
            Atualizado {updatedStr}
          </p>
        )}
      </div>

      <div style={{ height: updatedStr ? 88 : 68 }} />

      <div className="px-6 flex flex-col gap-6" style={{ paddingTop: 16 }}>
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
            <div className="text-4xl animate-spin">⚽</div>
          </div>
        ) : (
          <>
            {isCancelled && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderRadius: 12, background: 'var(--color-surface-primary)' }}>
                <span style={{ fontSize: 20 }}>🚫</span>
                <p style={{ fontFamily: 'var(--font-primary)', fontSize: 13, color: 'var(--color-fg-secondary)', lineHeight: 1.4 }}>
                  Jogo desta semana cancelado — sem placar nesta rodada.
                </p>
              </div>
            )}
            {/* Placar Atual — fiel ao Figma: logo + número lado a lado, p-16 */}
            <div style={{ background: 'var(--color-surface-primary)', borderRadius: 20, padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
                <img src="/team-blue.png" alt="Time Azul" style={{ width: 56, height: 56, objectFit: 'contain', flexShrink: 0 }} />
                <div>
                  <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 600, fontSize: 16, color: 'var(--color-fg-primary)', lineHeight: 1 }}>{String(blueWins).padStart(2, '0')}</p>
                  <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 400, fontSize: 11, color: 'var(--color-fg-primary)', textAlign: 'center' }}>Vitórias</p>
                </div>
              </div>
              <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 600, fontSize: 16, color: 'var(--color-fg-primary)' }}>x</p>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 600, fontSize: 16, color: 'var(--color-fg-primary)', lineHeight: 1 }}>{String(yellowWins).padStart(2, '0')}</p>
                  <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 400, fontSize: 11, color: 'var(--color-fg-primary)', textAlign: 'center' }}>Vitórias</p>
                </div>
                <img src="/team-yellow.png" alt="Time Preto" style={{ width: 56, height: 56, objectFit: 'contain', flexShrink: 0 }} />
              </div>
            </div>

            {/* Histórico */}
            {history.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 600, fontSize: 16, color: 'var(--color-fg-primary)' }}>Histórico</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[...history].reverse().map((entry, ri) => {
                    const originalIndex = history.length - 1 - ri
                    const dateStr = (() => { try { return format(new Date(entry.date), 'dd/MM', { locale: ptBR }) } catch { return '—' } })()
                    const blueWon = entry.blue > entry.yellow
                    const yellowWon = entry.yellow > entry.blue
                    return (
                      <div key={ri} style={{ background: 'var(--color-surface-primary)', borderRadius: 20, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <img src="/team-blue.png" alt="" style={{ width: 28, height: 28, objectFit: 'contain', flexShrink: 0 }} />
                        <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 700, fontSize: 22, color: blueWon ? 'var(--color-fg-accent)' : 'var(--color-fg-primary)', lineHeight: 1, width: 28, textAlign: 'center' }}>{entry.blue}</p>
                        <p style={{ fontFamily: 'var(--font-primary)', fontSize: 13, color: 'var(--color-fg-secondary)', flex: 1, textAlign: 'center' }}>{dateStr}</p>
                        <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 700, fontSize: 22, color: yellowWon ? '#f59e0b' : 'var(--color-fg-primary)', lineHeight: 1, width: 28, textAlign: 'center' }}>{entry.yellow}</p>
                        <img src="/team-yellow.png" alt="" style={{ width: 28, height: 28, objectFit: 'contain', flexShrink: 0 }} />
                        {isAdmin && (
                          <button onClick={() => deleteEntry.mutate(originalIndex)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', flexShrink: 0 }}>
                            <TrashSimple size={18} color="var(--color-fg-secondary)" />
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Sheet adicionar placar */}
      {showSheet && (
        <>
          <div onClick={() => setShowSheet(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 60 }} />
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 70, background: 'var(--color-bg)', borderRadius: '24px 24px 0 0', padding: '24px 24px calc(40px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 24 }}>
            <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 600, fontSize: 18, color: 'var(--color-fg-primary)', textAlign: 'center' }}>Adicionar Placar</p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <img src="/team-blue.png" alt="" style={{ width: 40, height: 40, objectFit: 'contain' }} />
                <input type="number" min="0" max="99" placeholder="0" value={blueGoals} onChange={e => setBlueGoals(e.target.value)} style={inputStyle} />
              </div>
              <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 700, fontSize: 32, color: 'var(--color-fg-secondary)' }}>×</p>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <img src="/team-yellow.png" alt="" style={{ width: 40, height: 40, objectFit: 'contain' }} />
                <input type="number" min="0" max="99" placeholder="0" value={yellowGoals} onChange={e => setYellowGoals(e.target.value)} style={inputStyle} />
              </div>
            </div>
            <button onClick={() => saveScore.mutate()} disabled={saveScore.isPending || (!blueGoals && !yellowGoals)} className="transition-all active:scale-95 disabled:opacity-40" style={{ width: '100%', height: 56, borderRadius: 9999, background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-fg)', fontFamily: 'var(--font-primary)', fontWeight: 500, fontSize: 16, border: 'none', cursor: 'pointer' }}>
              {saveScore.isPending ? 'Salvando...' : 'Salvar Placar'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

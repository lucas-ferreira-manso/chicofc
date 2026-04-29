import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuthStore } from '../store/authStore'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { X } from '@phosphor-icons/react'
import { toast } from 'sonner'

interface GameEntry {
  blue: number
  yellow: number
  date: string
}

interface ScoreData {
  blueWins: number
  yellowWins: number
  updatedAt: string
  history: GameEntry[]
}

async function fetchScore(): Promise<ScoreData> {
  const snap = await getDoc(doc(db, 'config', 'score'))
  if (!snap.exists()) return { blueWins: 0, yellowWins: 0, updatedAt: '', history: [] }
  return snap.data() as ScoreData
}

export default function StatsPage() {
  const user = useAuthStore(s => s.user)
  const isAdmin = user?.role === 'admin'
  const qc = useQueryClient()

  const { data: score, isLoading } = useQuery({ queryKey: ['score'], queryFn: fetchScore })

  const [showSheet, setShowSheet] = useState(false)
  const [blueGoals, setBlueGoals] = useState('')
  const [yellowGoals, setYellowGoals] = useState('')

  const saveScore = useMutation({
    mutationFn: async () => {
      const blue = parseInt(blueGoals) || 0
      const yellow = parseInt(yellowGoals) || 0
      const now = new Date().toISOString()

      const current = score ?? { blueWins: 0, yellowWins: 0, history: [] }
      const newBlueWins = current.blueWins + (blue > yellow ? 1 : 0)
      const newYellowWins = current.yellowWins + (yellow > blue ? 1 : 0)
      const newEntry: GameEntry = { blue, yellow, date: now }

      await setDoc(doc(db, 'config', 'score'), {
        blueWins: newBlueWins,
        yellowWins: newYellowWins,
        updatedAt: now,
        history: [...(current.history ?? []), newEntry]
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['score'] })
      toast.success('Placar salvo!')
      setShowSheet(false)
      setBlueGoals('')
      setYellowGoals('')
    },
    onError: () => toast.error('Erro ao salvar placar')
  })

  const updatedStr = score?.updatedAt
    ? format(new Date(score.updatedAt), "d 'de' MMMM 'às' HH'h'mm", { locale: ptBR })
    : null

  const blueWins = score?.blueWins ?? 0
  const yellowWins = score?.yellowWins ?? 0
  const history = score?.history ?? []

  return (
    <div className="flex flex-col min-h-full pb-28" style={{ background: 'var(--color-bg)' }}>

      {/* Header */}
      <div className="px-6 pt-12 pb-4">
        <p className="font-semibold" style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-24)', lineHeight: '28px' }}>
          Placar
        </p>
        <p style={{ color: 'var(--color-fg-secondary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)' }}>
          {updatedStr ? `Atualizado ${updatedStr}` : 'Nenhuma atualização ainda'}
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><div className="text-4xl animate-spin">⚽</div></div>
      ) : (
        <div className="px-6 flex flex-col gap-4">

          {/* Placar de vitórias */}
          <div className="flex items-center justify-between px-5 py-6 rounded-[20px]"
            style={{ background: 'var(--color-surface-primary)' }}>

            {/* Time Azul */}
            <div className="flex flex-col items-center gap-4">
              <p className="font-bold" style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-32)' }}>
                {String(blueWins).padStart(2, '0')}
              </p>
              <img src="/team-blue.png" alt="Time Azul" width={126} height={126} style={{ objectFit: 'contain' }} />
            </div>

            <p className="font-bold" style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-32)' }}>
              x
            </p>

            {/* Time Amarelo */}
            <div className="flex flex-col items-center gap-4">
              <p className="font-bold" style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-32)' }}>
                {String(yellowWins).padStart(2, '0')}
              </p>
              <img src="/team-yellow.png" alt="Time Amarelo" width={126} height={126} style={{ objectFit: 'contain' }} />
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: 'var(--color-border)' }} />

          {/* Histórico */}
          {history.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="font-semibold" style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)' }}>
                Histórico
              </p>
              {[...history].reverse().map((entry, i) => {
                const blueWon = entry.blue > entry.yellow
                const yellowWon = entry.yellow > entry.blue
                const dateStr = format(new Date(entry.date), "d MMM", { locale: ptBR })
                return (
                  <div key={i} className="flex items-center px-5 py-4 rounded-3xl"
                    style={{ background: 'var(--color-surface-primary)' }}>
                    {/* Time azul */}
                    <div className="flex items-center gap-2 flex-1">
                      <img src="/team-blue.png" alt="Azul" width={26} height={26} style={{ objectFit: 'contain' }} />
                      <p className="font-semibold" style={{
                        color: blueWon ? 'var(--color-fg-accent)' : 'var(--color-fg-secondary)',
                        fontFamily: 'var(--font-primary)',
                        fontSize: 'var(--font-size-16)'
                      }}>
                        {entry.blue}
                      </p>
                    </div>

                    {/* Data */}
                    <p style={{ color: 'var(--color-fg-secondary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-12)' }}>
                      {dateStr}
                    </p>

                    {/* Time amarelo */}
                    <div className="flex items-center gap-2 flex-1 justify-end">
                      <p className="font-semibold" style={{
                        color: yellowWon ? '#b8860b' : 'var(--color-fg-secondary)',
                        fontFamily: 'var(--font-primary)',
                        fontSize: 'var(--font-size-16)'
                      }}>
                        {entry.yellow}
                      </p>
                      <img src="/team-yellow.png" alt="Amarelo" width={26} height={26} style={{ objectFit: 'contain' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {history.length === 0 && (
            <p className="text-center py-8" style={{ color: 'var(--color-fg-secondary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)' }}>
              Nenhum jogo registrado ainda
            </p>
          )}
        </div>
      )}

      {/* Botão fixo — só para admins */}
      {isAdmin && (
        <div className="fixed inset-x-0 px-6 pt-4 pb-3"
          style={{ bottom: 90, background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(12px)', borderTop: '1px solid var(--color-border)' }}>
          <button
            onClick={() => setShowSheet(true)}
            className="w-full py-4 font-medium transition-all active:scale-95"
            style={{ background: 'var(--color-surface-accent)', color: 'white', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)' }}>
            Inserir Placar
          </button>
        </div>
      )}

      {/* Bottom Sheet */}
      {showSheet && (
        <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={() => setShowSheet(false)}>
          <div className="w-full rounded-t-3xl flex flex-col gap-6 pt-6 pb-10 px-6"
            style={{ background: 'var(--color-bg)' }}
            onClick={e => e.stopPropagation()}>

            {/* Header sheet */}
            <div className="flex items-center justify-between">
              <p className="font-semibold" style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)' }}>
                Adicionar placar
              </p>
              <button onClick={() => setShowSheet(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full"
                style={{ background: 'var(--color-surface-primary)' }}>
                <X size={16} color="var(--color-fg-secondary)" />
              </button>
            </div>

            {/* Inputs de gols */}
            <div className="flex items-center justify-between px-5 py-6 rounded-[20px]"
              style={{ background: 'var(--color-surface-primary)' }}>

              {/* Time Azul */}
              <div className="flex flex-col items-center gap-4">
                <input
                  type="number"
                  inputMode="numeric"
                  value={blueGoals}
                  onChange={e => setBlueGoals(e.target.value)}
                  placeholder="00"
                  min={0}
                  className="text-center font-bold outline-none w-[82px] rounded-[16px]"
                  style={{
                    background: 'white',
                    color: 'var(--color-fg-primary)',
                    fontFamily: 'var(--font-primary)',
                    fontSize: 'var(--font-size-32)',
                    padding: '8px 20px',
                    border: '2px solid transparent',
                  }}
                  onFocus={e => e.target.style.borderColor = 'var(--color-surface-accent)'}
                  onBlur={e => e.target.style.borderColor = 'transparent'}
                />
                <img src="/team-blue.png" alt="Time Azul" width={96} height={96} style={{ objectFit: 'contain' }} />
              </div>

              <p className="font-bold" style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-32)' }}>
                x
              </p>

              {/* Time Amarelo */}
              <div className="flex flex-col items-center gap-4">
                <input
                  type="number"
                  inputMode="numeric"
                  value={yellowGoals}
                  onChange={e => setYellowGoals(e.target.value)}
                  placeholder="00"
                  min={0}
                  className="text-center font-bold outline-none w-[82px] rounded-[16px]"
                  style={{
                    background: 'white',
                    color: 'var(--color-fg-primary)',
                    fontFamily: 'var(--font-primary)',
                    fontSize: 'var(--font-size-32)',
                    padding: '8px 20px',
                    border: '2px solid transparent',
                  }}
                  onFocus={e => e.target.style.borderColor = 'var(--color-surface-accent-yellow)'}
                  onBlur={e => e.target.style.borderColor = 'transparent'}
                />
                <img src="/team-yellow.png" alt="Time Amarelo" width={96} height={96} style={{ objectFit: 'contain' }} />
              </div>
            </div>

            {/* Botão salvar */}
            <button
              onClick={() => saveScore.mutate()}
              disabled={saveScore.isPending || (blueGoals === '' && yellowGoals === '')}
              className="w-full py-4 font-medium transition-all active:scale-95 disabled:opacity-40"
              style={{ background: 'var(--color-surface-accent)', color: 'white', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)' }}>
              {saveScore.isPending ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

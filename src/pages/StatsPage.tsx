import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { doc, getDoc, setDoc, updateDoc, arrayUnion } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuthStore } from '../store/authStore'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'

interface TeamScore {
  blue: number
  yellow: number
  updatedAt: string
  history: { blue: number; yellow: number; date: string }[]
}

async function fetchScore(): Promise<TeamScore> {
  const snap = await getDoc(doc(db, 'config', 'score'))
  if (!snap.exists()) return { blue: 0, yellow: 0, updatedAt: '', history: [] }
  return snap.data() as TeamScore
}

export default function StatsPage() {
  const user = useAuthStore(s => s.user)
  const isAdmin = user?.role === 'admin'
  const qc = useQueryClient()

  const { data: score, isLoading } = useQuery({ queryKey: ['score'], queryFn: fetchScore })

  const [showEdit, setShowEdit] = useState(false)
  const [editBlue, setEditBlue] = useState(0)
  const [editYellow, setEditYellow] = useState(0)

  const saveScore = useMutation({
    mutationFn: async () => {
      const now = new Date().toISOString()
      const newEntry = { blue: editBlue, yellow: editYellow, date: now }
      await setDoc(doc(db, 'config', 'score'), {
        blue: editBlue,
        yellow: editYellow,
        updatedAt: now,
        history: arrayUnion(newEntry)
      }, { merge: true })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['score'] })
      toast.success('Placar atualizado!')
      setShowEdit(false)
    },
    onError: () => toast.error('Erro ao salvar placar')
  })

  const openEdit = () => {
    setEditBlue(score?.blue ?? 0)
    setEditYellow(score?.yellow ?? 0)
    setShowEdit(true)
  }

  const updatedStr = score?.updatedAt
    ? format(new Date(score.updatedAt), "d 'de' MMMM 'às' HH'h'mm", { locale: ptBR })
    : null

  const blueWins = score?.blue ?? 0
  const yellowWins = score?.yellow ?? 0

  return (
    <div className="flex flex-col min-h-full pb-28" style={{ background: 'var(--color-bg)' }}>

      {/* Header */}
      <div className="px-6 pt-12 pb-4">
        <p className="font-semibold" style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-24)', lineHeight: '28px' }}>
          Placar
        </p>
        {updatedStr ? (
          <p style={{ color: 'var(--color-fg-secondary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)' }}>
            Atualizado {updatedStr}
          </p>
        ) : (
          <p style={{ color: 'var(--color-fg-secondary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)' }}>
            Nenhuma atualização ainda
          </p>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><div className="text-4xl animate-spin">⚽</div></div>
      ) : (
        <div className="px-6 flex flex-col gap-4">

          {/* Placar principal */}
          <div className="flex items-center justify-between p-5 rounded-3xl"
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
          {score?.history && score.history.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="font-semibold" style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)' }}>
                Histórico
              </p>
              {[...score.history].reverse().map((entry, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-4 rounded-3xl"
                  style={{ background: 'var(--color-surface-primary)' }}>
                  <div className="flex items-center gap-2">
                    <img src="/team-blue.png" alt="Azul" width={26} height={26} style={{ objectFit: 'contain' }} />
                    <p className="font-medium" style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)' }}>
                      {entry.blue}
                    </p>
                  </div>
                  <p style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-11)' }}>x</p>
                  <div className="flex items-center gap-2">
                    <p className="font-medium" style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)' }}>
                      {entry.yellow}
                    </p>
                    <img src="/team-yellow.png" alt="Amarelo" width={26} height={26} style={{ objectFit: 'contain' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal editar placar — só para admins */}
      {showEdit && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-end"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={() => setShowEdit(false)}>
          <div className="w-full p-6 rounded-t-3xl flex flex-col gap-5"
            style={{ background: 'var(--color-bg)' }}
            onClick={e => e.stopPropagation()}>
            <p className="font-semibold text-center" style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-18)' }}>
              Editar Placar
            </p>

            <div className="flex items-center justify-between gap-4">
              {/* Time Azul */}
              <div className="flex flex-col items-center gap-3 flex-1">
                <img src="/team-blue.png" alt="Azul" width={56} height={56} style={{ objectFit: 'contain' }} />
                <div className="flex items-center gap-3">
                  <button onClick={() => setEditBlue(Math.max(0, editBlue - 1))}
                    className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-xl"
                    style={{ background: 'var(--color-surface-primary)', color: 'var(--color-fg-primary)' }}>
                    −
                  </button>
                  <p className="font-bold w-8 text-center" style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-32)' }}>
                    {editBlue}
                  </p>
                  <button onClick={() => setEditBlue(editBlue + 1)}
                    className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-xl"
                    style={{ background: 'var(--color-surface-accent)', color: 'white' }}>
                    +
                  </button>
                </div>
              </div>

              <p className="font-bold" style={{ color: 'var(--color-fg-secondary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-24)' }}>x</p>

              {/* Time Amarelo */}
              <div className="flex flex-col items-center gap-3 flex-1">
                <img src="/team-yellow.png" alt="Amarelo" width={56} height={56} style={{ objectFit: 'contain' }} />
                <div className="flex items-center gap-3">
                  <button onClick={() => setEditYellow(Math.max(0, editYellow - 1))}
                    className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-xl"
                    style={{ background: 'var(--color-surface-primary)', color: 'var(--color-fg-primary)' }}>
                    −
                  </button>
                  <p className="font-bold w-8 text-center" style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-32)' }}>
                    {editYellow}
                  </p>
                  <button onClick={() => setEditYellow(editYellow + 1)}
                    className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-xl"
                    style={{ background: 'var(--color-surface-accent-yellow)', color: 'var(--color-fg-primary)' }}>
                    +
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={() => saveScore.mutate()}
              disabled={saveScore.isPending}
              className="w-full py-4 font-medium transition-all active:scale-95 disabled:opacity-40"
              style={{ background: 'var(--color-surface-accent)', color: 'white', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)' }}>
              {saveScore.isPending ? 'Salvando...' : 'Salvar'}
            </button>

            <button onClick={() => setShowEdit(false)}
              className="w-full py-3 font-medium"
              style={{ color: 'var(--color-fg-secondary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)' }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Botão fixo — só para admins */}
      {isAdmin && (
        <div className="fixed inset-x-0 px-6 pt-4 pb-3"
          style={{ bottom: 90, background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(12px)', borderTop: '1px solid var(--color-border)' }}>
          <button
            onClick={openEdit}
            className="w-full py-4 font-medium transition-all active:scale-95"
            style={{ background: 'var(--color-surface-accent)', color: 'white', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)' }}>
            Editar Placar
          </button>
        </div>
      )}
    </div>
  )
}

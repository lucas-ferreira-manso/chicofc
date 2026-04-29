import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { collection, addDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuthStore } from '../store/authStore'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { format, nextWednesday } from 'date-fns'
import { ptBR } from 'date-fns/locale'

function getNextWednesday() {
  const next = nextWednesday(new Date())
  return format(next, 'yyyy-MM-dd')
}

export default function NewGamePage() {
  const navigate = useNavigate()
  const user = useAuthStore(s => s.user)
  const qc = useQueryClient()
  const [location, setLocation] = useState('')
  const [max_players, setMaxPlayers] = useState(14)
  const [date, setDate] = useState(getNextWednesday())

  const createGame = useMutation({
    mutationFn: async () => {
      await addDoc(collection(db, 'games'), {
        title: 'Pelada de quarta',
        date: `${date}T21:30:00`,
        location,
        max_players,
        created_by: user!.id,
        status: 'upcoming',
        created_at: new Date().toISOString()
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['games'] })
      toast.success('Pelada marcada! ⚽')
      navigate('/games')
    },
    onError: () => toast.error('Erro ao criar pelada')
  })

  const inputStyle = { background: 'var(--surface2)', border: '1px solid var(--border)' }
  const dateLabel = format(new Date(date + 'T12:00:00'), "EEEE, d 'de' MMMM", { locale: ptBR })

  return (
    <div className="flex flex-col min-h-full pb-24 px-4">
      <div className="pt-5 pb-4">
        <Link to="/games" className="flex items-center gap-1 text-sm" style={{ color: 'var(--text-muted)' }}>
          <ArrowLeft size={16} /> Cancelar
        </Link>
        <h1 className="text-2xl font-bold text-white mt-4">Nova pelada</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Toda quarta · 21h30 às 22h30</p>
      </div>

      <form onSubmit={e => { e.preventDefault(); createGame.mutate() }} className="space-y-4">
        <div>
          <label className="block text-sm mb-1.5" style={{ color: 'var(--text-muted)' }}>Data</label>
          <input type="date" className="w-full px-4 py-3 rounded-xl text-white outline-none"
            style={inputStyle} value={date} onChange={e => setDate(e.target.value)} required />
          <p className="text-xs mt-1.5 capitalize" style={{ color: 'var(--text-muted)' }}>{dateLabel}</p>
        </div>

        <div>
          <label className="block text-sm mb-1.5" style={{ color: 'var(--text-muted)' }}>Local</label>
          <input className="w-full px-4 py-3 rounded-xl text-white outline-none"
            style={inputStyle} placeholder="Ex: Sociedade Blumenau"
            value={location} onChange={e => setLocation(e.target.value)} required />
        </div>

        <div>
          <label className="block text-sm mb-1.5" style={{ color: 'var(--text-muted)' }}>
            Vagas — <span className="text-white">{max_players} jogadores</span>
          </label>
          <input type="range" min={6} max={30} step={2} value={max_players}
            onChange={e => setMaxPlayers(Number(e.target.value))} className="w-full accent-green-600" />
        </div>

        <button type="submit" disabled={createGame.isPending}
          className="w-full py-4 rounded-2xl font-semibold text-white mt-2 transition-all active:scale-95 disabled:opacity-50"
          style={{ background: 'var(--green)' }}>
          {createGame.isPending ? 'Salvando...' : 'Marcar pelada ⚽'}
        </button>
      </form>
    </div>
  )
}
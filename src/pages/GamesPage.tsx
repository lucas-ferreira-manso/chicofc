import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { collection, getDocs, orderBy, query } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { MapPin, Users, Plus, Calendar } from 'lucide-react'
import type { Game } from '../types'

async function fetchGames(): Promise<Game[]> {
  const q = query(collection(db, 'games'), orderBy('date', 'asc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as Game)
}

export default function GamesPage() {
  const { data: games = [], isLoading } = useQuery({ queryKey: ['games'], queryFn: fetchGames })
  const upcoming = games.filter(g => g.status === 'upcoming')
  const past = games.filter(g => g.status === 'done')

  return (
    <div className="flex flex-col min-h-full pb-24">
      <div className="px-4 pt-6 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Peladas</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{upcoming.length} próxima{upcoming.length !== 1 ? 's' : ''}</p>
        </div>
        <Link to="/games/new" className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-white text-sm"
          style={{ background: 'var(--green)' }}>
          <Plus size={16} /> Nova
        </Link>
      </div>
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center"><div className="text-4xl animate-spin">⚽</div></div>
      ) : (
        <div className="px-4 space-y-6">
          {upcoming.length === 0 && (
            <div className="text-center py-16">
              <div className="text-5xl mb-4">📅</div>
              <p className="text-white font-medium">Nenhuma pelada marcada</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Que tal marcar uma?</p>
            </div>
          )}
          {upcoming.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>Próximas</h2>
              <div className="space-y-3">{upcoming.map(g => <GameCard key={g.id} game={g} />)}</div>
            </section>
          )}
          {past.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>Anteriores</h2>
              <div className="space-y-3">{past.map(g => <GameCard key={g.id} game={g} past />)}</div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

function GameCard({ game, past = false }: { game: Game; past?: boolean }) {
  const dateStr = format(new Date(game.date), "EEE, d 'de' MMM · HH'h'mm", { locale: ptBR })
  return (
    <Link to={`/games/${game.id}`} className="block rounded-2xl p-4"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)', opacity: past ? 0.6 : 1 }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white truncate">{game.title}</h3>
          <div className="flex items-center gap-1 mt-1.5 text-sm" style={{ color: 'var(--text-muted)' }}>
            <Calendar size={13} /><span className="capitalize">{dateStr}</span>
          </div>
          <div className="flex items-center gap-1 mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            <MapPin size={13} /><span className="truncate">{game.location}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 text-sm shrink-0" style={{ color: 'var(--text-muted)' }}>
          <Users size={13} /><span>{game.max_players}</span>
        </div>
      </div>
    </Link>
  )
}

import { useQuery } from '@tanstack/react-query'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { Trophy, Calendar } from 'lucide-react'

interface PlayerStat {
  id: string
  name: string
  goals: number
  games: number
}

async function fetchStats(): Promise<PlayerStat[]> {
  const [profilesSnap, goalsSnap, attendSnap] = await Promise.all([
    getDocs(collection(db, 'profiles')),
    getDocs(collection(db, 'goals')),
    getDocs(collection(db, 'attendances'))
  ])
  return profilesSnap.docs.map(d => {
    const data = d.data()
    const goals = goalsSnap.docs.filter(g => g.data().scorer_id === d.id).length
    const games = attendSnap.docs.filter(a => a.data().user_id === d.id).length
    return { id: d.id, name: data.name || data.email, goals, games }
  }).sort((a, b) => b.goals - a.goals)
}

export default function StatsPage() {
  const { data: stats = [], isLoading } = useQuery({ queryKey: ['stats'], queryFn: fetchStats })
  const topScorer = stats[0]
  const mostGames = [...stats].sort((a, b) => b.games - a.games)[0]

  return (
    <div className="flex flex-col min-h-full pb-24">
      <div className="px-4 pt-6 pb-4">
        <h1 className="text-2xl font-bold text-white">Estatísticas</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>Artilheiros e presença</p>
      </div>
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center"><div className="text-4xl animate-spin">⚽</div></div>
      ) : stats.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">📊</div>
          <p className="text-white font-medium">Ainda sem estatísticas</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Jogue uma pelada para começar!</p>
        </div>
      ) : (
        <div className="px-4 space-y-6">
          <div className="grid grid-cols-2 gap-3">
            {topScorer && (
              <div className="p-4 rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="flex items-center gap-1.5 text-xs mb-2" style={{ color: 'var(--green)' }}>
                  <Trophy size={12} /> Artilheiro
                </div>
                <p className="font-bold text-white text-sm truncate">{topScorer.name}</p>
                <p className="text-2xl font-bold mt-1" style={{ color: 'var(--green)' }}>{topScorer.goals} ⚽</p>
              </div>
            )}
            {mostGames && (
              <div className="p-4 rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="flex items-center gap-1.5 text-xs mb-2" style={{ color: '#60a5fa' }}>
                  <Calendar size={12} /> Mais presente
                </div>
                <p className="font-bold text-white text-sm truncate">{mostGames.name}</p>
                <p className="text-2xl font-bold mt-1" style={{ color: '#60a5fa' }}>{mostGames.games} jogos</p>
              </div>
            )}
          </div>
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>Artilharia</h2>
            <div className="space-y-2">
              {stats.map((p, i) => (
                <div key={p.id} className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'var(--surface)' }}>
                  <span className="w-6 text-center text-sm font-bold shrink-0"
                    style={{ color: i === 0 ? '#fbbf24' : i === 1 ? '#9ca3af' : i === 2 ? '#b45309' : 'var(--text-muted)' }}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{p.name}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{p.games} jogos</p>
                  </div>
                  <span className="text-sm font-bold" style={{ color: 'var(--text-muted)' }}>{p.goals} ⚽</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

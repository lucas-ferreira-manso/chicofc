import { useQuery } from '@tanstack/react-query'
import Header from '../components/layout/Header'
import { fetchVotingRanking } from '../lib/playerStats'
import type { PlayerVotingStats } from '../lib/playerStats'

export default function RankingVotacaoPage() {
  const { data: ranking = [], isLoading } = useQuery({
    queryKey: ['voting-ranking'],
    queryFn: fetchVotingRanking,
    staleTime: 5 * 60_000
  })

  const withVotes = ranking.filter(p => p.bolaCheiaWins > 0 || p.bolaMurchaWins > 0)
  const cheiaRanking = [...ranking].sort((a, b) => b.bolaCheiaWins - a.bolaCheiaWins).filter(p => p.bolaCheiaWins > 0)
  const murchaRanking = [...ranking].sort((a, b) => b.bolaMurchaWins - a.bolaMurchaWins).filter(p => p.bolaMurchaWins > 0)

  return (
    <div className="flex flex-col min-h-full pb-28" style={{ background: 'var(--color-bg)' }}>
      <Header title="Ranking" subtitle="Bola Cheia & Bola Murcha" />
      <div style={{ height: 96 }} />

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="text-4xl animate-spin">⚽</div>
        </div>
      ) : withVotes.length === 0 ? (
        <p className="text-center py-12"
          style={{ color: 'var(--color-fg-secondary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)' }}>
          Nenhuma votação registrada ainda.
        </p>
      ) : (
        <div className="px-6 flex flex-col gap-6">

          {/* Bola Cheia */}
          {cheiaRanking.length > 0 && (
            <section className="flex flex-col gap-3">
              <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 600, fontSize: 'var(--font-size-16)', color: 'var(--color-fg-accent)' }}>
                Bola Cheia
              </p>
              {cheiaRanking.map((player, i) => (
                <VotingCard key={player.id} player={player} rank={i + 1} type="bolaCheia" />
              ))}
            </section>
          )}

          {/* Bola Murcha */}
          {murchaRanking.length > 0 && (
            <section className="flex flex-col gap-3">
              <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 600, fontSize: 'var(--font-size-16)', color: '#ed0000' }}>
                Bola Murcha
              </p>
              {murchaRanking.map((player, i) => (
                <VotingCard key={player.id} player={player} rank={i + 1} type="bolaMurcha" />
              ))}
            </section>
          )}

        </div>
      )}
    </div>
  )
}

function VotingCard({ player, rank, type }: {
  player: PlayerVotingStats
  rank: number
  type: 'bolaCheia' | 'bolaMurcha'
}) {
  const isCheia = type === 'bolaCheia'
  const wins = isCheia ? player.bolaCheiaWins : player.bolaMurchaWins
  const accentColor = isCheia ? 'var(--color-fg-accent)' : '#ed0000'

  return (
    <div className="flex items-center gap-3 p-4 rounded-[20px]"
      style={{ background: 'var(--color-surface-primary)' }}>

      {/* Rank */}
      <span style={{
        fontFamily: 'var(--font-primary)', fontWeight: 700,
        fontSize: 'var(--font-size-16)', color: 'var(--color-fg-secondary)',
        width: 24, textAlign: 'center', flexShrink: 0
      }}>
        {rank}
      </span>

      {/* Avatar */}
      <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 overflow-hidden"
        style={{ background: 'var(--color-avatar-bg)' }}>
        {player.photoURL ? (
          <img src={player.photoURL} alt={player.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{
            color: 'var(--color-avatar-fg)', fontFamily: 'var(--font-primary)',
            fontSize: 'var(--font-size-16)', fontWeight: 700
          }}>
            {player.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
          </span>
        )}
      </div>

      {/* Nome */}
      <p className="flex-1 font-medium truncate"
        style={{ color: 'var(--color-fg-primary)', fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)' }}>
        {player.name}
      </p>

      {/* Contagem */}
      <span style={{
        fontFamily: 'var(--font-primary)', fontWeight: 700,
        fontSize: 'var(--font-size-16)', color: accentColor
      }}>
        {wins}x
      </span>
    </div>
  )
}

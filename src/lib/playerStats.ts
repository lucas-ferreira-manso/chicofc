import { collection, getDocs, doc, getDoc } from 'firebase/firestore'
import { db } from './firebase'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PlayerInfo {
  id: string
  name: string
  photoURL?: string
}

export interface PresenceRecord {
  gameId: string   // yyyy-MM-dd
  date: string     // ISO string from game doc
  status: 'confirmed' | 'waitlist' | 'declined'
}

export interface PlayerPresenceStats extends PlayerInfo {
  totalGames: number
  confirmed: number
  declined: number
  waitlist: number
  /** confirmed / totalGames, 0–1 */
  presenceRate: number
  records: PresenceRecord[]
}

export interface VotingRecord {
  gameId: string
  date: string
  wonBolaCheia: boolean
  wonBolaMurcha: boolean
}

export interface PlayerVotingStats extends PlayerInfo {
  bolaCheiaWins: number
  bolaMurchaWins: number
  records: VotingRecord[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pluralityWinner(
  votos: Record<string, { bolaCheia: string; bolaMurcha: string }>,
  type: 'bolaCheia' | 'bolaMurcha'
): string | null {
  const counts: Record<string, number> = {}
  Object.values(votos).forEach(v => {
    const id = v[type]
    if (id) counts[id] = (counts[id] || 0) + 1
  })
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1])
  return entries[0]?.[0] ?? null
}

// ─── Fetchers ─────────────────────────────────────────────────────────────────

async function fetchAllPlayers(): Promise<Map<string, PlayerInfo>> {
  const snap = await getDocs(collection(db, 'players'))
  const map = new Map<string, PlayerInfo>()
  snap.docs.forEach(d => {
    const data = d.data()
    map.set(d.id, {
      id: d.id,
      name: data.name || data.email || 'Jogador',
      photoURL: data.photoURL
    })
  })
  return map
}

/**
 * Retorna estatísticas de presença de todos os jogadores, ordenado por
 * taxa de presença decrescente.
 */
export async function fetchPresenceStats(): Promise<PlayerPresenceStats[]> {
  const [attendancesSnap, playersMap] = await Promise.all([
    getDocs(collection(db, 'attendances')),
    fetchAllPlayers()
  ])

  const byPlayer = new Map<string, PresenceRecord[]>()

  attendancesSnap.docs.forEach(d => {
    const data = d.data()
    const userId = data.user_id as string
    if (!byPlayer.has(userId)) byPlayer.set(userId, [])
    byPlayer.get(userId)!.push({
      gameId: data.game_id,
      date: data.game_id,
      status: data.status as PresenceRecord['status']
    })
  })

  const stats: PlayerPresenceStats[] = []

  byPlayer.forEach((records, playerId) => {
    const player = playersMap.get(playerId)
    if (!player) return

    const confirmed = records.filter(r => r.status === 'confirmed').length
    const declined = records.filter(r => r.status === 'declined').length
    const waitlist = records.filter(r => r.status === 'waitlist').length
    const total = records.length

    stats.push({
      ...player,
      totalGames: total,
      confirmed,
      declined,
      waitlist,
      presenceRate: total > 0 ? confirmed / total : 0,
      records: records.sort((a, b) => b.gameId.localeCompare(a.gameId))
    })
  })

  return stats.sort((a, b) => b.presenceRate - a.presenceRate)
}

/**
 * Retorna ranking de votos de todos os jogadores (bola cheia e murcha),
 * agregando todos os jogos já encerrados.
 * Ordenado por bolaCheiaWins decrescente.
 */
export async function fetchVotingRanking(): Promise<PlayerVotingStats[]> {
  // game_ids vêm de attendances — fonte de verdade de quais jogos aconteceram
  const attendancesSnap = await getDocs(collection(db, 'attendances'))
  const gameIds = [...new Set(attendancesSnap.docs.map(d => d.data().game_id as string))]

  const [playersMap, votacaoDocs] = await Promise.all([
    fetchAllPlayers(),
    Promise.all(
      gameIds.map(async gameId => {
        const snap = await getDoc(doc(db, 'votacao', gameId))
        if (!snap.exists()) return null
        return { gameId, votos: snap.data().votos as Record<string, { bolaCheia: string; bolaMurcha: string }> }
      })
    )
  ])

  const byPlayer = new Map<string, VotingRecord[]>()

  votacaoDocs.forEach(game => {
    if (!game || !game.votos || Object.keys(game.votos).length === 0) return

    const cheiaWinner = pluralityWinner(game.votos, 'bolaCheia')
    const murchaWinner = pluralityWinner(game.votos, 'bolaMurcha')

    playersMap.forEach((_, playerId) => {
      if (!byPlayer.has(playerId)) byPlayer.set(playerId, [])
      const wonCheia = cheiaWinner === playerId
      const wonMurcha = murchaWinner === playerId
      if (wonCheia || wonMurcha) {
        byPlayer.get(playerId)!.push({
          gameId: game.gameId,
          date: game.gameId,
          wonBolaCheia: wonCheia,
          wonBolaMurcha: wonMurcha
        })
      }
    })
  })

  const stats: PlayerVotingStats[] = []

  playersMap.forEach((player, playerId) => {
    const records = byPlayer.get(playerId) ?? []
    stats.push({
      ...player,
      bolaCheiaWins: records.filter(r => r.wonBolaCheia).length,
      bolaMurchaWins: records.filter(r => r.wonBolaMurcha).length,
      records: records.sort((a, b) => b.gameId.localeCompare(a.gameId))
    })
  })

  return stats.sort((a, b) => b.bolaCheiaWins - a.bolaCheiaWins)
}

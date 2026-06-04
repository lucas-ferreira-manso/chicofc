import { collection, getDocs, doc, getDoc, query, where } from 'firebase/firestore'
import { format } from 'date-fns'
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

/** yyyy-MM-dd da última segunda-feira (inclusive hoje se hoje for segunda) */
function lastMondayDate(): string {
  const d = new Date()
  const day = d.getDay() // 0=Dom, 1=Seg, …
  const daysSince = day === 0 ? 6 : day - 1
  d.setDate(d.getDate() - daysSince)
  return d.toISOString().slice(0, 10)
}

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
 * Retorna os jogadores confirmados no último jogo, ordenados pelo total
 * de presenças confirmadas em todos os jogos (decrescente).
 */
export async function fetchLastGamePlayers(): Promise<PlayerPresenceStats[]> {
  const [attendancesSnap, playersMap] = await Promise.all([
    getDocs(collection(db, 'attendances')),
    fetchAllPlayers()
  ])

  // Descobre o game_id mais recente já ocorrido (ignora jogos futuros)
  const today = new Date().toISOString().slice(0, 10)
  const allGameIds = [...new Set(attendancesSnap.docs.map(d => d.data().game_id as string))]
  const pastIds = allGameIds.filter(id => id <= today).sort()
  const lastGameId = pastIds[pastIds.length - 1]
  if (!lastGameId) return []

  // Quem confirmou no último jogo
  const confirmedLastGame = new Set(
    attendancesSnap.docs
      .filter(d => d.data().game_id === lastGameId && d.data().status === 'confirmed')
      .map(d => d.data().user_id as string)
  )

  if (confirmedLastGame.size === 0) return []

  // Agrega presenças entre D0 (primeiro jogo real) e hoje
  const D0 = '2026-05-06'
  const byPlayer = new Map<string, PresenceRecord[]>()
  attendancesSnap.docs.forEach(d => {
    const data = d.data()
    const userId = data.user_id as string
    if (!confirmedLastGame.has(userId)) return
    if (data.game_id < D0 || data.game_id > today) return
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
    stats.push({
      ...player,
      totalGames: records.length,
      confirmed,
      declined: records.filter(r => r.status === 'declined').length,
      waitlist: records.filter(r => r.status === 'waitlist').length,
      presenceRate: records.length > 0 ? confirmed / records.length : 0,
      records: records.sort((a, b) => b.gameId.localeCompare(a.gameId))
    })
  })

  // Ordena por total de confirmações (maior primeiro)
  return stats.sort((a, b) => b.confirmed - a.confirmed)
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
  // Só conta jogos cujo ciclo de votação já encerrou (antes da última segunda-feira)
  const cutoff = lastMondayDate()
  const gameIds = [...new Set(attendancesSnap.docs.map(d => d.data().game_id as string))]
    .filter(id => id < cutoff)

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

// ─── Ranking Completo ─────────────────────────────────────────────────────────

export interface HistoryEntry {
  gameId: string
  cheiaWinner: PlayerInfo | null
  murchaWinner: PlayerInfo | null
}

export interface RankingEntry {
  id: string
  name: string
  photoURL?: string
  player_type: string
  wins: number
  draws: number
  losses: number
  presences: number
  bolaCheiaWins: number
  bolaMurchaWins: number
  score: number
}

/** Dado o ISO datetime de quando o placar foi salvo, retorna o gameId (quarta-feira) */
function getWednesdayGameId(dateStr: string): string {
  const d = new Date(dateStr)
  const day = d.getDay() // 0=Dom 1=Seg 2=Ter 3=Qua 4=Qui 5=Sex 6=Sáb
  const daysBack = [4, 5, 6, 0, 1, 2, 3][day]
  d.setDate(d.getDate() - daysBack)
  return format(d, 'yyyy-MM-dd')
}

export async function fetchFullRanking(): Promise<RankingEntry[]> {
  const [playersSnap, scoreDoc, attendancesSnap, votacaoSnap] = await Promise.all([
    getDocs(query(collection(db, 'players'), where('active', '==', true))),
    getDoc(doc(db, 'config', 'score')),
    getDocs(collection(db, 'attendances')),
    getDocs(collection(db, 'votacao'))
  ])

  const players = playersSnap.docs.map(d => ({
    id: d.id,
    name: d.data().name || d.data().email || 'Jogador',
    photoURL: d.data().photoURL as string | undefined,
    player_type: (d.data().player_type as string) || 'mensalista'
  }))

  // Histórico de placares
  const history: { blue: number; yellow: number; date: string }[] =
    scoreDoc.exists() ? (scoreDoc.data().history ?? []) : []

  // Busca lineups para cada gameId único derivado das datas do histórico
  const gameIds = [...new Set(history.map(e => getWednesdayGameId(e.date)))]
  const lineupDocs = await Promise.all(gameIds.map(gid => getDoc(doc(db, 'lineups', gid))))
  const lineupMap: Record<string, { blue: string[]; black: string[] }> = {}
  lineupDocs.forEach((snap, i) => {
    if (snap.exists()) lineupMap[gameIds[i]] = snap.data() as { blue: string[]; black: string[] }
  })

  // V / E / D por jogador
  const winsMap: Record<string, number> = {}
  const drawsMap: Record<string, number> = {}
  const lossesMap: Record<string, number> = {}

  history.forEach(entry => {
    const gid = getWednesdayGameId(entry.date)
    const lineup = lineupMap[gid]
    if (!lineup) return
    const blueWon = entry.blue > entry.yellow
    const blackWon = entry.yellow > entry.blue
    const isDraw = entry.blue === entry.yellow
    ;[...lineup.blue, ...lineup.black].forEach(uid => {
      const isBlue = lineup.blue.includes(uid)
      if (isDraw) {
        drawsMap[uid] = (drawsMap[uid] || 0) + 1
      } else if ((isBlue && blueWon) || (!isBlue && blackWon)) {
        winsMap[uid] = (winsMap[uid] || 0) + 1
      } else {
        lossesMap[uid] = (lossesMap[uid] || 0) + 1
      }
    })
  })

  // Presenças confirmadas (jogos passados)
  const today = new Date().toISOString().slice(0, 10)
  const presenceMap: Record<string, number> = {}
  attendancesSnap.docs.forEach(d => {
    const data = d.data()
    if (data.status === 'confirmed' && data.game_id <= today) {
      presenceMap[data.user_id] = (presenceMap[data.user_id] || 0) + 1
    }
  })

  // Bola Cheia / Murcha wins
  const bolaCheiaWinsMap: Record<string, number> = {}
  const bolaMurchaWinsMap: Record<string, number> = {}
  votacaoSnap.docs.forEach(d => {
    const votos = d.data().votos ?? {}
    if (Object.keys(votos).length === 0) return
    const cheiaId = pluralityWinner(votos, 'bolaCheia')
    const murchaId = pluralityWinner(votos, 'bolaMurcha')
    if (cheiaId) bolaCheiaWinsMap[cheiaId] = (bolaCheiaWinsMap[cheiaId] || 0) + 1
    if (murchaId) bolaMurchaWinsMap[murchaId] = (bolaMurchaWinsMap[murchaId] || 0) + 1
  })

  return players
    .filter(p => (presenceMap[p.id] || 0) > 0)
    .map(p => {
      const w = winsMap[p.id] || 0
      const dr = drawsMap[p.id] || 0
      const l = lossesMap[p.id] || 0
      const pr = presenceMap[p.id] || 0
      const bc = bolaCheiaWinsMap[p.id] || 0
      const bm = bolaMurchaWinsMap[p.id] || 0
      const score = w * 3 + dr + pr + bc * 5 - bm * 2
      return { ...p, wins: w, draws: dr, losses: l, presences: pr, bolaCheiaWins: bc, bolaMurchaWins: bm, score }
    })
    .sort((a, b) => b.score - a.score || b.presences - a.presences)
}

import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from './firebase'

// Vagas do jogo. Ao completar, ninguém mais confirma presença nem adiciona avulso temporário.
export const MAX_GAME_PLAYERS = 16

// Vagas ocupadas = confirmados + lista de espera + avulsos temporários.
// Mesma conta do contador "x/16" da home.
export async function fetchOccupiedSpots(gameId: string): Promise<number> {
  const [attSnap, tempSnap] = await Promise.all([
    getDocs(query(collection(db, 'attendances'), where('game_id', '==', gameId))),
    getDocs(query(collection(db, 'avulsos_temp'), where('gameId', '==', gameId)))
  ])
  const occupiedAttendances = attSnap.docs.filter(d => {
    const status = d.data().status
    return status === 'confirmed' || status === 'waitlist'
  }).length
  return occupiedAttendances + tempSnap.size
}

export class GameFullError extends Error {
  constructor() {
    super(`Lista completa (${MAX_GAME_PLAYERS}/${MAX_GAME_PLAYERS})`)
    this.name = 'GameFullError'
  }
}

// Confere com dados frescos na hora de gravar — o contador da tela pode estar desatualizado
export async function assertGameHasSpot(gameId: string): Promise<void> {
  if (await fetchOccupiedSpots(gameId) >= MAX_GAME_PLAYERS) throw new GameFullError()
}

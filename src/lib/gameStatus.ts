import { doc, getDoc, setDoc, collection, getDocs, query, where } from 'firebase/firestore'
import { db } from './firebase'

/**
 * Um "jogo" é implícito pela data (quarta-feira, gameId = yyyy-MM-dd). Para
 * poder CANCELAR um jogo (sem quórum, feriado, etc.) guardamos um doc opcional
 * em `games/{gameId}`. Sem doc, ou status != 'cancelled', o jogo é normal.
 *
 * Efeitos do cancelamento (ver telas que consomem estes helpers):
 * - Sem votação (Bola Cheia/Murcha, Prêmio Lúcio/Rodrigo) e sem placar.
 * - Presenças confirmadas SÃO mantidas e continuam valendo +1 no ranking
 *   (quem confirmou ganha o ponto mesmo sem jogo).
 */
export interface GameCancellation {
  cancelled: boolean
  reason?: string
}

export async function fetchGameCancellation(gameId: string): Promise<GameCancellation> {
  const snap = await getDoc(doc(db, 'games', gameId))
  if (snap.exists() && snap.data().status === 'cancelled') {
    return { cancelled: true, reason: (snap.data().reason as string | undefined) || undefined }
  }
  return { cancelled: false }
}

export async function cancelGame(gameId: string, reason: string, userId: string): Promise<void> {
  await setDoc(
    doc(db, 'games', gameId),
    {
      status: 'cancelled',
      reason: reason.trim() || null,
      cancelled_at: new Date().toISOString(),
      cancelled_by: userId,
    },
    { merge: true }
  )
}

export async function reactivateGame(gameId: string): Promise<void> {
  await setDoc(
    doc(db, 'games', gameId),
    { status: 'upcoming', reason: null, reactivated_at: new Date().toISOString() },
    { merge: true }
  )
}

/** Conjunto de gameIds cancelados — usado pelo ranking para ignorar votação/placar. */
export async function fetchCancelledGameIds(): Promise<Set<string>> {
  const snap = await getDocs(query(collection(db, 'games'), where('status', '==', 'cancelled')))
  return new Set(snap.docs.map(d => d.id))
}

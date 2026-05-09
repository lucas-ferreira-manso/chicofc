import { useState } from 'react'
import Header from '../components/layout/Header'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  doc, getDoc, setDoc, collection, query, where, getDocs
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuthStore } from '../store/authStore'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { X, TrashSimple } from '@phosphor-icons/react'
import { toast } from 'sonner'

// ─── Types ────────────────────────────────────────────────────────────────────

interface GameEntry { blue: number; yellow: number; date: string }
interface ScoreData {
  blueWins: number; yellowWins: number; updatedAt: string; history: GameEntry[]
}
const EMPTY_SCORE: ScoreData = { blueWins: 0, yellowWins: 0, updatedAt: '', history: [] }

interface PlayerInfo { id: string; name: string; photoURL?: string }
interface VotacaoData {
  votos: Record<string, { bolaCheia: string; bolaMurcha: string }>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getLastWednesdayId(): string {
  const today = new Date()
  const daysBack = (today.getDay() - 3 + 7) % 7
  const d = new Date(today)
  d.setDate(today.getDate() - daysBack)
  return format(d, 'yyyy-MM-dd')
}

// Votação aberta de quarta (dia do jogo) até domingo; encerrada toda segunda-feira.
// Dias: 0=dom 1=seg 2=ter 3=qua 4=qui 5=sex 6=sáb
function isVotingOpen(): boolean {
  const day = new Date().getDay()
  return day !== 1 && day !== 2 // seg e ter = fechado
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
}

function computeWinner(
  votos: Record<string, { bolaCheia: string; bolaMurcha: string }>,
  type: 'bolaCheia' | 'bolaMurcha'
): string | null {
  const counts: Record<string, number> = {}
  Object.values(votos).forEach(v => {
    const id = v[type]
    if (id) counts[id] = (counts[id] || 0) + 1
  })
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
}

// ─── Data Fetching ─────────────────────────────────────────────────────────────

async function fetchScore(): Promise<ScoreData> {
  const snap = await getDoc(doc(db, 'config', 'score'))
  if (!snap.exists()) return EMPTY_SCORE
  const data = snap.data()
  return {
    blueWins: data.blueWins ?? 0,
    yellowWins: data.yellowWins ?? 0,
    updatedAt: data.updatedAt ?? '',
    history: data.history ?? []
  }
}

async function fetchConfirmedPlayers(gameId: string): Promise<PlayerInfo[]> {
  const q = query(
    collection(db, 'attendances'),
    where('game_id', '==', gameId),
    where('status', '==', 'confirmed')
  )
  const snap = await getDocs(q)
  const userIds = [...new Set(snap.docs.map(d => d.data().user_id as string))]
  const profiles = await Promise.all(
    userIds.map(async id => {
      const pSnap = await getDoc(doc(db, 'players', id))
      if (!pSnap.exists()) return null
      const data = pSnap.data()
      return { id, name: data.name || data.email || 'Jogador', photoURL: data.photoURL } as PlayerInfo
    })
  )
  return profiles.filter(Boolean) as PlayerInfo[]
}

async function fetchVotacao(gameId: string): Promise<VotacaoData> {
  const snap = await getDoc(doc(db, 'votacao', gameId))
  if (!snap.exists()) return { votos: {} }
  return { votos: snap.data().votos ?? {} }
}

// ─── SVG Icons (paths extraídos do Figma) ────────────────────────────────────
//
// Bola Cheia: 3 camadas sobrepostas em container 52×52
//   1. Círculo branco base  (Ellipse2, viewBox 42.25×42.25, offset 4.878, 4.878)
//   2. Padrão externo azul  (Vector4, viewBox 42.25×42.25, offset 4.878, 4.878)
//   3. Padrão interno azul 20% opacidade (Vector3, viewBox 38.99×38.38, offset 6.51, 6.5)
//
// Bola Murcha: 1 camada (Vector5, viewBox 42×26, offset 5, 13)

function BolaCheiaIcon({ size = 52 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* 1 — círculo branco base */}
      <circle cx="26.003" cy="26.003" r="21.125" fill="white" />

      {/* 2 — padrão externo (Vector4) deslocado 4.878, 4.878 */}
      <g transform="translate(4.878 4.878)">
        <path d="M21.125 0C16.9469 0 12.8626 1.23896 9.38859 3.5602C5.9146 5.88145 3.20696 9.18072 1.60805 13.0408C0.00915311 16.9009 -0.409192 21.1484 0.40592 25.2463C1.22103 29.3441 3.23299 33.1082 6.18738 36.0626C9.14176 39.017 12.9059 41.029 17.0037 41.8441C21.1016 42.6592 25.3491 42.2409 29.2092 40.642C33.0693 39.043 36.3686 36.3354 38.6898 32.8614C41.011 29.3874 42.25 25.3031 42.25 21.125C42.2441 15.5241 40.0165 10.1543 36.0561 6.1939C32.0957 2.23348 26.7259 0.00591463 21.125 0ZM36.6681 29.9447H29.8391L27.9581 27.3528L30.5236 19.8819L33.5705 18.8886L38.9005 22.9775C38.6483 25.4297 37.888 27.8025 36.6681 29.9447ZM3.35563 22.9775L8.67548 18.8906L11.7224 19.8839L14.2878 27.3548L12.4109 29.9447H5.58188C4.36059 27.8028 3.59894 25.43 3.34548 22.9775H3.35563ZM5.38688 12.6912L6.5061 16.4694L3.39423 18.8439C3.67012 16.6894 4.33934 14.604 5.3686 12.6912H5.38688ZM17.2656 26L14.9378 19.2258L21.125 14.9723L27.3122 19.2258L24.9844 26H17.2656ZM35.7642 16.4694L36.8834 12.6912C37.9127 14.604 38.5819 16.6894 38.8578 18.8439L35.7642 16.4694ZM34.5048 9.28281L32.5731 15.7991L29.512 16.7923L22.75 12.1448V8.98016L28.6589 4.91766C30.8845 5.95846 32.8733 7.44403 34.5028 9.28281H34.5048ZM24.7955 3.62984L21.125 6.15266L17.4545 3.62984C19.8753 3.12338 22.3747 3.12338 24.7955 3.62984ZM13.5911 4.91766L19.5 8.98016V12.1448L12.74 16.7923L9.67892 15.7991L7.7472 9.28281C9.3767 7.44403 11.3655 5.95846 13.5911 4.91766ZM7.95235 33.1947H12.09L13.5464 37.312C11.4315 36.3168 9.53129 34.9181 7.95235 33.1947ZM17.4688 38.6202L15.0556 31.8317L16.9305 29.25H25.3195L27.1944 31.8317L24.7914 38.6202C22.3734 39.1269 19.8766 39.1269 17.4586 38.6202H17.4688ZM28.7138 37.312L30.1702 33.1947H34.3078C32.7259 34.9192 30.8221 36.3179 28.7036 37.312H28.7138Z" fill="#082996" />
      </g>

      {/* 3 — padrão interno opacidade 20% (Vector3) deslocado 6.51, 6.5 */}
      <g transform="translate(6.51 6.5)">
        <path opacity="0.2" d="M6.73362 15.4538L0.0304992 20.601C0.0101867 20.2353 3.09285e-05 19.8697 3.09285e-05 19.5C-0.00790877 15.0494 1.51303 10.7311 4.30831 7.26783L6.73362 15.4538ZM3.02659 29.9447C5.6781 34.1213 9.81624 37.1356 14.6047 38.3785L11.6188 29.9447H3.02659ZM24.3974 38.3785C29.1859 37.1356 33.324 34.1213 35.9755 29.9447H27.3833L24.3974 38.3785ZM34.6836 7.26783L32.2583 15.4538L38.9614 20.601C38.9817 20.2353 38.9919 19.8697 38.9919 19.5C38.9998 15.0494 37.4789 10.7311 34.6836 7.26783ZM26.8592 1.43814C22.1377 -0.479381 16.8543 -0.479381 12.1327 1.43814L19.496 6.50002L26.8592 1.43814ZM24.5172 26L27.621 16.961L19.496 11.375L11.371 16.961L14.4747 26H24.5172Z" fill="#082996" />
      </g>
    </svg>
  )
}

function BolaMurchaIcon({ size = 52 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Vector5 deslocado 5, 13 (top:25% left:9.62% do container 52×52) */}
      <g transform="translate(5 13)">
        <path d="M19.7331 0.0191938C20.1094 -0.00477482 20.6325 0.00166455 21.0182 0.00121654C25.6557 -0.0417927 30.2301 1.05623 34.3225 3.19476C35.94 4.05192 37.3849 5.03083 38.6833 6.29422C40.8786 8.43023 41.7294 10.764 41.9106 13.7443C41.9511 14.4091 41.9924 14.9594 41.9986 15.6436C42.0381 17.786 41.2361 19.8773 39.631 21.3707C35.1877 25.5047 28.1252 26.0041 22.3368 25.9847C20.4914 25.9844 18.4344 26.0353 16.5972 25.9532C11.9014 25.7434 6.32233 24.8203 2.67626 21.6812C1.07033 20.2701 0.0423455 18.2628 0.00503808 16.1387C-0.0559792 12.6686 0.409192 9.27457 2.94855 6.66843C6.20304 3.32833 10.9291 1.34906 15.4714 0.493358C16.879 0.237711 18.303 0.0792835 19.7331 0.0191938Z" fill="#ED0000" />
        <path d="M26.4473 3.62037C26.612 3.61057 27.3204 3.85317 27.5103 3.91203C29.9847 4.67959 31.6946 5.64382 33.7754 7.1007C33.7121 8.41735 33.359 9.98545 33.2764 11.3354C31.7315 11.6115 30.0801 12.0076 28.5319 12.3328C28.0925 12.4327 27.6491 12.5148 27.2116 12.6248C25.3456 11.7708 23.3249 10.7929 21.4724 9.89887C21.4361 8.46568 21.4691 6.89445 21.4707 5.45106C22.0488 5.26575 22.741 4.98944 23.3123 4.77372C24.3519 4.37527 25.397 3.99082 26.4473 3.62037Z" fill="white" />
        <path d="M15.4954 3.61892C15.6835 3.61309 20.0608 5.29308 20.515 5.46383C20.5302 6.94278 20.5167 8.44155 20.5146 9.9215C19.9185 10.1672 19.2354 10.5081 18.6447 10.7868L14.7881 12.6245L13.5363 12.3628C12.0118 11.9929 10.2674 11.6552 8.72314 11.3305C8.58951 9.95185 8.3735 8.50796 8.22038 7.11733C10.8275 5.23518 12.3982 4.54602 15.4954 3.61892Z" fill="white" />
        <path d="M33.6204 12.0832C33.6816 12.0778 33.7179 12.0783 33.7716 12.117C35.0646 13.0502 36.4492 13.889 37.7462 14.812C37.7393 15.5605 37.7414 16.1495 37.5447 16.8831C37.2042 18.1527 36.4929 19.1299 35.5017 19.9864C35.2768 20.1809 34.9509 20.4711 34.697 20.6153C33.1323 20.6249 31.2827 20.6666 29.7462 20.8353C29.668 20.841 29.6139 20.8447 29.5486 20.7934C29.0256 20.3833 28.5329 19.9314 28.0375 19.4894C27.2331 18.769 26.4244 18.0533 25.6114 17.3423C26.2533 16.0999 26.9363 14.6479 27.5162 13.3786C28.0134 13.2372 29.0369 13.0659 29.587 12.9505C30.9333 12.6698 32.2779 12.3808 33.6204 12.0832Z" fill="white" />
        <path d="M8.28482 12.0699C10.3392 12.5302 12.4001 12.9617 14.4671 13.3642C14.5438 13.5153 14.6161 13.6794 14.6864 13.8344C15.2236 15.019 15.8273 16.178 16.3643 17.3623C16.0431 17.6138 15.602 18.0285 15.2901 18.3052L13.3504 20.0183C13.2003 20.1504 12.5347 20.7512 12.4029 20.8201C12.2198 20.8086 12.0329 20.7887 11.8494 20.7736C10.3356 20.6493 8.8105 20.641 7.29295 20.6155C6.87937 20.3623 6.30999 19.8537 5.96548 19.4937C4.60539 18.0726 4.22403 16.6938 4.26985 14.8084L8.28482 12.0699Z" fill="white" />
        <path d="M17.2467 17.7306L24.7299 17.7414C25.5574 18.4385 26.3481 19.2131 27.1768 19.9146C27.6573 20.3214 28.165 20.7622 28.6166 21.198C27.2594 21.934 26.3198 22.5394 25.1286 23.5187L24.8201 23.5255C24.6248 23.5249 24.4304 23.5275 24.235 23.533C21.8147 23.6017 19.3132 23.6356 16.8963 23.5047C15.6523 22.5283 14.7508 21.975 13.4104 21.185C14.6257 20.0454 15.9987 18.8613 17.2467 17.7306Z" fill="white" />
        <path d="M1.2131 12.6269C1.99998 13.6487 2.29387 13.9672 3.25644 14.8616C3.15731 17.6684 4.16136 19.3499 6.32119 21.0549C6.25606 21.4569 6.27834 21.9926 6.28817 22.4059C6.29131 22.5395 6.3377 22.8485 6.31919 22.9535L6.27182 22.9376C4.63824 22.131 3.22782 21.1568 2.17949 19.6598C1.01045 17.9904 0.902301 16.185 1.05553 14.2407C1.09192 13.7788 1.12843 13.0721 1.2131 12.6269Z" fill="white" />
        <path d="M40.7581 12.6287C40.8872 12.7536 40.9901 15.201 40.9914 15.5246C40.9913 15.8225 40.9783 16.1204 40.9527 16.4172C40.9106 16.9112 40.8164 17.3994 40.6714 17.8742C39.9269 20.3197 37.9611 21.7765 35.7752 22.9287C35.7057 22.9687 35.7345 22.962 35.656 22.9643C35.6411 22.8298 35.7318 22.4599 35.7381 22.3005C35.755 21.8708 35.7243 21.4508 35.696 21.0233C37.4862 19.6406 38.6058 18.1007 38.7357 15.8126C38.7522 15.5216 38.781 15.1741 38.7456 14.8874C38.9669 14.6351 39.3057 14.3381 39.5518 14.088C39.996 13.6365 40.3996 13.1483 40.7581 12.6287Z" fill="white" />
        <path d="M25.634 1.24977C26.1981 1.30129 27.0284 1.495 27.5831 1.62795C30.7653 2.39063 34.0055 3.73109 36.5934 5.72407C36.9402 5.99114 37.5569 6.45752 37.8343 6.7853C36.6019 6.63757 35.7086 6.54595 34.4613 6.5128C32.2077 4.76168 29.5957 3.50697 26.803 2.83405C26.5396 2.37165 26.2594 1.95965 25.8946 1.56674C25.8144 1.48039 25.681 1.34688 25.634 1.24977Z" fill="white" />
        <path d="M16.2311 1.25005L16.2897 1.24115L16.3225 1.26752C16.2448 1.41845 15.9896 1.66726 15.8643 1.82457C15.6214 2.13359 15.4081 2.464 15.2273 2.81154C14.6006 3.029 13.9285 3.18132 13.2479 3.42101C11.7144 3.94742 10.2529 4.65735 8.89683 5.53473C8.4032 5.85909 8.02008 6.16581 7.55033 6.49947C6.77476 6.53038 5.9981 6.5581 5.22745 6.65459C4.91636 6.69352 4.60568 6.73518 4.29373 6.7671C4.24077 6.77718 4.26597 6.78082 4.2182 6.75601C4.23083 6.73837 4.24346 6.72068 4.25608 6.70303C7.05625 4.09622 10.7588 2.50684 14.4741 1.61669C15.04 1.48117 15.6569 1.32806 16.2311 1.25005Z" fill="white" />
        <path d="M16.9631 24.2571C17.5841 24.2877 18.2156 24.3523 18.8537 24.3822C19.9409 24.4244 21.0292 24.4368 22.1171 24.4193C22.9402 24.407 24.2056 24.3001 25.0129 24.2863C25.2228 24.2828 26.6574 24.8694 26.9421 24.992C26.3997 25.0243 25.8438 25.0643 25.3015 25.072C24.7182 25.0934 24.1382 25.0994 23.5548 25.0957C20.7638 25.0778 17.9761 25.1609 15.1893 25.0072C15.5841 24.8152 16.5518 24.3835 16.9631 24.2571Z" fill="white" />
      </g>
    </svg>
  )
}

// ─── Player Avatar ─────────────────────────────────────────────────────────────

function PlayerAvatar({ player, size = 32 }: { player: PlayerInfo; size?: number }) {
  const initials = getInitials(player.name)
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'var(--color-avatar-bg)', overflow: 'hidden',
      flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      {player.photoURL ? (
        <img src={player.photoURL} alt={player.name}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <span style={{
          color: 'var(--color-avatar-fg)', fontFamily: 'var(--font-primary)',
          fontSize: size * 0.38, fontWeight: 600
        }}>
          {initials}
        </span>
      )}
    </div>
  )
}

// ─── Badge Votação ─────────────────────────────────────────────────────────────

interface BadgeProps {
  type: 'bolaCheia' | 'bolaMurcha'
  player?: PlayerInfo | null
  onClick?: () => void
  disabled?: boolean
}

function BadgeVotacao({ type, player, onClick, disabled }: BadgeProps) {
  const isMurcha = type === 'bolaMurcha'
  // Bola Cheia usa var(--color-fg-accent) para adaptar ao dark mode (#082996 light / #66d1ff dark)
  // Bola Murcha usa vermelho fixo — legível em ambos os modos
  const accentColor = isMurcha ? '#ed0000' : 'var(--color-fg-accent)'
  const label = isMurcha ? 'Bola Murcha' : 'Bola Cheia'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 133, position: 'relative' }}>
      {/* Área da foto/placeholder */}
      <button
        onClick={onClick}
        disabled={disabled || !onClick}
        style={{
          height: 150, borderRadius: 24, width: '100%',
          background: player ? 'var(--color-surface-secondary)' : 'white',
          border: player ? 'none' : '1.5px solid var(--color-border)',
          overflow: 'hidden', position: 'relative',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: (disabled || !onClick) ? 'default' : 'pointer',
          padding: 0
        }}>
        {player ? (
          player.photoURL ? (
            <img
              src={player.photoURL} alt={player.name}
              style={{
                position: 'absolute', top: -6, left: -14,
                width: 157, height: 157, objectFit: 'cover',
                pointerEvents: 'none'
              }}
            />
          ) : (
            <span style={{
              fontFamily: 'var(--font-primary)', fontWeight: 700,
              fontSize: 48, color: accentColor, opacity: 0.4
            }}>
              {getInitials(player.name)}
            </span>
          )
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M12 5V19M5 12H19" stroke={accentColor}
              strokeWidth="2" strokeLinecap="round" />
          </svg>
        )}
      </button>

      {/* Texto */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{
          fontFamily: 'var(--font-primary)', fontWeight: 700,
          fontSize: 18, lineHeight: '18px', color: accentColor
        }}>
          {label}
        </span>
        <span style={{
          fontFamily: 'var(--font-primary)', fontWeight: 500,
          fontSize: 14, color: 'var(--color-fg-secondary)'
        }}>
          {player ? player.name : 'nome atleta'}
        </span>
      </div>

      {/* Ícone da bola sobreposto */}
      <div style={{ position: 'absolute', right: -3, top: 118, pointerEvents: 'none' }}>
        {isMurcha ? <BolaMurchaIcon size={52} /> : <BolaCheiaIcon size={52} />}
      </div>
    </div>
  )
}

// ─── Voting Bottom Sheet ───────────────────────────────────────────────────────

interface VotingSheetProps {
  type: 'bolaCheia' | 'bolaMurcha'
  players: PlayerInfo[]
  onClose: () => void
  onVote: (playerId: string) => void
}

function VotingSheet({ type, players, onClose, onVote }: VotingSheetProps) {
  const [selected, setSelected] = useState<string | null>(null)
  const isMurcha = type === 'bolaMurcha'
  const title = isMurcha ? 'Vote no Bola Murcha' : 'Vote no Bola Cheia'
  const accentColor = isMurcha ? '#ed0000' : 'var(--color-fg-accent)'

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'flex-end'
      }}
      onClick={onClose}>
      <div
        style={{
          width: '100%', background: 'var(--color-bg)',
          borderRadius: '24px 24px 0 0',
          padding: '24px 24px 40px',
          maxHeight: '82vh',
          display: 'flex', flexDirection: 'column', gap: 24
        }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{
            fontFamily: 'var(--font-primary)', fontWeight: 600,
            fontSize: 16, color: 'var(--color-fg-primary)'
          }}>
            {title}
          </span>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: 16,
              background: 'var(--color-surface-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: 'none', cursor: 'pointer', flexShrink: 0
            }}>
            <X size={16} color="var(--color-fg-secondary)" />
          </button>
        </div>

        {/* Lista de jogadores */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 8,
          overflowY: 'auto', flex: 1
        }}>
          {players.length === 0 && (
            <p style={{
              textAlign: 'center', padding: '24px 0',
              fontFamily: 'var(--font-primary)', fontSize: 14,
              color: 'var(--color-fg-secondary)'
            }}>
              Nenhum jogador disponível
            </p>
          )}
          {players.map(player => (
            <button
              key={player.id}
              onClick={() => setSelected(player.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: 16, borderRadius: 24, width: '100%',
                background: 'var(--color-surface-primary)',
                border: selected === player.id
                  ? `2px solid ${accentColor}`
                  : '2px solid transparent',
                cursor: 'pointer',
                transition: 'border-color 0.15s'
              }}>
              <PlayerAvatar player={player} size={32} />
              <span style={{
                fontFamily: 'var(--font-primary)', fontWeight: 500,
                fontSize: 16, color: 'var(--color-fg-primary)'
              }}>
                {player.name}
              </span>
            </button>
          ))}
        </div>

        {/* Botão Votar */}
        <button
          onClick={() => selected && onVote(selected)}
          disabled={!selected}
          style={{
            width: '100%', height: 56, borderRadius: 9999,
            background: selected ? accentColor : 'var(--color-surface-secondary)',
            color: selected ? 'white' : 'var(--color-fg-secondary)',
            fontFamily: 'var(--font-primary)', fontWeight: 500, fontSize: 16,
            border: 'none', cursor: selected ? 'pointer' : 'default',
            flexShrink: 0, transition: 'background 0.15s, color 0.15s'
          }}>
          Votar
        </button>
      </div>
    </div>
  )
}

// ─── Aba Jogador ───────────────────────────────────────────────────────────────

function JogadorTab() {
  const user = useAuthStore(s => s.user)
  const gameId = getLastWednesdayId()
  const qc = useQueryClient()

  const [sheetType, setSheetType] = useState<'bolaCheia' | 'bolaMurcha' | null>(null)
  const [pendingCheia, setPendingCheia] = useState<string | null>(null)
  const [pendingMurcha, setPendingMurcha] = useState<string | null>(null)

  const { data: players = [], isLoading: loadingPlayers } = useQuery({
    queryKey: ['confirmed-players', gameId],
    queryFn: () => fetchConfirmedPlayers(gameId),
    refetchInterval: 30_000
  })

  const { data: votacao, isLoading: loadingVotacao } = useQuery({
    queryKey: ['votacao', gameId],
    queryFn: () => fetchVotacao(gameId),
    refetchInterval: 10_000
  })

  const saveVote = useMutation({
    mutationFn: async (votes: { bolaCheia: string; bolaMurcha: string }) => {
      const current = votacao ?? { votos: {} }
      await setDoc(doc(db, 'votacao', gameId), {
        votos: { ...current.votos, [user!.id]: votes }
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['votacao', gameId] })
      toast.success('Voto registrado!')
    },
    onError: () => toast.error('Erro ao votar. Tente novamente.')
  })

  const handleSelectVote = (type: 'bolaCheia' | 'bolaMurcha', playerId: string) => {
    if (type === 'bolaCheia') setPendingCheia(playerId)
    else setPendingMurcha(playerId)
    setSheetType(null)
  }

  const handleShare = async () => {
    const cheiaId = votacao ? computeWinner(votacao.votos, 'bolaCheia') : null
    const murchaId = votacao ? computeWinner(votacao.votos, 'bolaMurcha') : null
    const cheiaName = players.find(p => p.id === cheiaId)?.name ?? '?'
    const murchaName = players.find(p => p.id === murchaId)?.name ?? '?'
    const text = `⚽ Bola Cheia: ${cheiaName}\n🫨 Bola Murcha: ${murchaName}\n#ChicoFC`
    if (navigator.share) {
      try { await navigator.share({ text }) } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(text)
      toast.success('Copiado para a área de transferência!')
    }
  }

  if (loadingPlayers || loadingVotacao) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
        <div className="text-4xl animate-spin">⚽</div>
      </div>
    )
  }

  const myVote = votacao?.votos?.[user!.id]
  const hasVoted = !!myVote
  const userWasConfirmed = players.some(p => p.id === user!.id)
  const votingOpen = isVotingOpen()

  // Vencedores calculados por pluralidade
  const cheiaWinnerId = votacao ? computeWinner(votacao.votos, 'bolaCheia') : null
  const murchaWinnerId = votacao ? computeWinner(votacao.votos, 'bolaMurcha') : null
  const cheiaWinner = players.find(p => p.id === cheiaWinnerId) ?? null
  const murchaWinner = players.find(p => p.id === murchaWinnerId) ?? null

  // Seleções locais pendentes
  const pendingCheiaPlayer = players.find(p => p.id === pendingCheia) ?? null
  const pendingMurchaPlayer = players.find(p => p.id === pendingMurcha) ?? null
  const bothSelected = pendingCheia !== null && pendingMurcha !== null

  // Jogadores votáveis (sem o próprio usuário, sem o já selecionado no outro tipo)
  const votableForCheia = players.filter(p => p.id !== user!.id && p.id !== pendingMurcha)
  const votableForMurcha = players.filter(p => p.id !== user!.id && p.id !== pendingCheia)

  // ── Estado: votação encerrada (toda segunda-feira) ────────────────────────
  if (!votingOpen) {
    if (cheiaWinnerId || murchaWinnerId) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 10,
          padding: 16, background: 'var(--color-surface-primary)', borderRadius: 24
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 8 }}>
            <p style={{
              fontFamily: 'var(--font-primary)', fontWeight: 600,
              fontSize: 24, lineHeight: '28px', color: 'var(--color-fg-accent)'
            }}>
              Parabéns aos envolvidos!
            </p>
            <p style={{
              fontFamily: 'var(--font-primary)', fontWeight: 500,
              fontSize: 16, color: 'var(--color-fg-secondary)'
            }}>
              Vocês foram os escolhidos ao bola cheia e bola murcha da rodada!
            </p>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 8px' }}>
            <BadgeVotacao type="bolaCheia" player={cheiaWinner} disabled />
            <BadgeVotacao type="bolaMurcha" player={murchaWinner} disabled />
          </div>
          <button
            onClick={handleShare}
            style={{
              width: '100%', height: 56, borderRadius: 9999,
              background: 'transparent', border: '2px solid var(--color-fg-accent)',
              color: 'var(--color-fg-accent)', fontFamily: 'var(--font-primary)',
              fontWeight: 500, fontSize: 16, cursor: 'pointer'
            }}>
            Compartilhar
          </button>
        </div>
      )
    }
    return (
      <p style={{
        textAlign: 'center', padding: '32px 0',
        fontFamily: 'var(--font-primary)', fontSize: 16,
        color: 'var(--color-fg-secondary)'
      }}>
        Votação encerrada. Volte na quarta após o jogo!
      </p>
    )
  }

  // ── Estado: usuário já votou (votação ainda aberta) ───────────────────────
  // Compartilhar não aparece aqui — só após encerramento (segunda-feira)
  if (hasVoted) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 10,
        padding: 16, background: 'var(--color-surface-primary)', borderRadius: 24
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 8 }}>
          <p style={{
            fontFamily: 'var(--font-primary)', fontWeight: 600,
            fontSize: 24, lineHeight: '28px', color: 'var(--color-fg-accent)'
          }}>
            Parabéns aos envolvidos!
          </p>
          <p style={{
            fontFamily: 'var(--font-primary)', fontWeight: 500,
            fontSize: 16, color: 'var(--color-fg-secondary)'
          }}>
            Vocês foram os escolhidos ao bola cheia e bola murcha da rodada!
          </p>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 8px' }}>
          <BadgeVotacao type="bolaCheia" player={cheiaWinner} disabled />
          <BadgeVotacao type="bolaMurcha" player={murchaWinner} disabled />
        </div>
      </div>
    )
  }

  // ── Estado: usuário não jogou ─────────────────────────────────────────────
  if (!userWasConfirmed) {
    // Se já há votos, exibe o resultado mesmo sem poder votar
    if (cheiaWinnerId || murchaWinnerId) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 10,
          padding: 16, background: 'var(--color-surface-primary)', borderRadius: 24
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 8 }}>
            <p style={{
              fontFamily: 'var(--font-primary)', fontWeight: 600,
              fontSize: 24, lineHeight: '28px', color: 'var(--color-fg-accent)'
            }}>
              Parabéns aos envolvidos!
            </p>
            <p style={{
              fontFamily: 'var(--font-primary)', fontWeight: 500,
              fontSize: 16, color: 'var(--color-fg-secondary)'
            }}>
              Vocês foram os escolhidos ao bola cheia e bola murcha da rodada!
            </p>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 8px' }}>
            <BadgeVotacao type="bolaCheia" player={cheiaWinner} disabled />
            <BadgeVotacao type="bolaMurcha" player={murchaWinner} disabled />
          </div>
        </div>
      )
    }

    return (
      <p style={{
        textAlign: 'center', padding: '32px 0',
        fontFamily: 'var(--font-primary)', fontSize: 16,
        color: 'var(--color-fg-secondary)'
      }}>
        Você não participou deste jogo.
      </p>
    )
  }

  // ── Estado: pré-votação ───────────────────────────────────────────────────
  return (
    <>
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 10,
        padding: 16, background: 'var(--color-surface-primary)', borderRadius: 24
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 8, textAlign: 'center' }}>
          <p style={{
            fontFamily: 'var(--font-primary)', fontWeight: 600,
            fontSize: 24, lineHeight: '28px', color: 'var(--color-fg-accent)'
          }}>
            Chegou a hora de julgar!
          </p>
          <p style={{
            fontFamily: 'var(--font-primary)', fontWeight: 500,
            fontSize: 16, color: 'var(--color-fg-secondary)'
          }}>
            Vote no Bola Cheia e Bola murcha da rodada!
          </p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 8px' }}>
          <BadgeVotacao
            type="bolaCheia"
            player={pendingCheiaPlayer}
            onClick={() => setSheetType('bolaCheia')}
          />
          <BadgeVotacao
            type="bolaMurcha"
            player={pendingMurchaPlayer}
            onClick={() => setSheetType('bolaMurcha')}
          />
        </div>

        {/* Botão confirmar — aparece quando ambos estão selecionados */}
        {bothSelected && (
          <button
            onClick={() => saveVote.mutate({ bolaCheia: pendingCheia!, bolaMurcha: pendingMurcha! })}
            disabled={saveVote.isPending}
            className="transition-all active:scale-95 disabled:opacity-40"
            style={{
              width: '100%', height: 56, borderRadius: 9999,
              background: 'var(--color-surface-accent)', color: 'white',
              fontFamily: 'var(--font-primary)', fontWeight: 500, fontSize: 16,
              border: 'none', cursor: 'pointer'
            }}>
            {saveVote.isPending ? 'Salvando...' : 'Confirmar votos'}
          </button>
        )}
      </div>

      {sheetType && (
        <VotingSheet
          type={sheetType}
          players={sheetType === 'bolaCheia' ? votableForCheia : votableForMurcha}
          onClose={() => setSheetType(null)}
          onVote={(id) => handleSelectVote(sheetType, id)}
        />
      )}
    </>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function StatsPage() {
  const user = useAuthStore(s => s.user)
  const isAdmin = user?.role === 'admin'
  const qc = useQueryClient()

  const [activeTab, setActiveTab] = useState<'placar' | 'jogador'>('placar')
  const [showSheet, setShowSheet] = useState(false)
  const [blueGoals, setBlueGoals] = useState('')
  const [yellowGoals, setYellowGoals] = useState('')

  const { data: score, isLoading } = useQuery({ queryKey: ['score'], queryFn: fetchScore })

  const saveScore = useMutation({
    mutationFn: async () => {
      const blue = parseInt(blueGoals) || 0
      const yellow = parseInt(yellowGoals) || 0
      const now = new Date().toISOString()
      const current = score ?? EMPTY_SCORE
      const newData: ScoreData = {
        blueWins: current.blueWins + (blue > yellow ? 1 : 0),
        yellowWins: current.yellowWins + (yellow > blue ? 1 : 0),
        updatedAt: now,
        history: [...current.history, { blue, yellow, date: now }]
      }
      await setDoc(doc(db, 'config', 'score'), newData)
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

  const deleteEntry = useMutation({
    mutationFn: async (originalIndex: number) => {
      const current = score ?? EMPTY_SCORE
      const newHistory = current.history.filter((_, i) => i !== originalIndex)
      await setDoc(doc(db, 'config', 'score'), {
        ...current,
        blueWins: newHistory.filter(e => e.blue > e.yellow).length,
        yellowWins: newHistory.filter(e => e.yellow > e.blue).length,
        history: newHistory,
        updatedAt: new Date().toISOString()
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['score'] })
      toast.success('Jogo removido!')
    },
    onError: () => toast.error('Erro ao remover jogo')
  })

  const updatedStr = score?.updatedAt
    ? format(new Date(score.updatedAt), "d 'de' MMMM 'às' HH'h'mm", { locale: ptBR })
    : null

  const blueWins = score?.blueWins ?? 0
  const yellowWins = score?.yellowWins ?? 0
  const history = score?.history ?? []

  const gameId = getLastWednesdayId()
  const gameDate = format(new Date(gameId + 'T12:00:00'), "d 'de' MMMM", { locale: ptBR })

  const subtitle = activeTab === 'placar'
    ? (updatedStr ? `Atualizado ${updatedStr}` : 'Nenhuma atualização ainda')
    : `Jogo de ${gameDate}`

  return (
    <div className="flex flex-col min-h-full pb-28" style={{ background: 'var(--color-bg)' }}>
      <Header title="Stats" subtitle={subtitle} />
      <div style={{ height: 96 }} />

      <div className="px-6 flex flex-col gap-4">

        {/* Tabs */}
        <div style={{
          display: 'flex', gap: 16, padding: 8,
          background: 'var(--color-surface-secondary)',
          borderRadius: 20
        }}>
          {(['placar', 'jogador'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1, padding: '8px 20px',
                borderRadius: 16, border: 'none',
                background: activeTab === tab ? 'white' : 'transparent',
                color: activeTab === tab ? '#1a1a1a' : 'var(--color-fg-primary)',
                fontFamily: 'var(--font-primary)', fontWeight: 500,
                fontSize: 16, cursor: 'pointer',
                transition: 'background 0.15s',
                boxShadow: activeTab === tab ? '0 1px 4px rgba(0,0,0,0.08)' : 'none'
              }}>
              {tab === 'placar' ? 'Placar' : 'Jogador'}
            </button>
          ))}
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'var(--color-border)' }} />

        {/* ── Aba Placar ── */}
        {activeTab === 'placar' && (
          <>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="text-4xl animate-spin">⚽</div>
              </div>
            ) : (
              <>
                {/* Placar geral */}
                <div className="flex items-center justify-between px-5 py-6 rounded-[20px]"
                  style={{ background: 'var(--color-surface-primary)' }}>
                  <div className="flex flex-col items-center gap-4">
                    <p className="font-bold" style={{
                      color: 'var(--color-fg-primary)',
                      fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-32)'
                    }}>
                      {String(blueWins).padStart(2, '0')}
                    </p>
                    <img src="/team-blue.png" alt="Time Azul" width={126} height={126}
                      style={{ objectFit: 'contain' }} />
                  </div>
                  <p className="font-bold" style={{
                    color: 'var(--color-fg-primary)',
                    fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-32)'
                  }}>x</p>
                  <div className="flex flex-col items-center gap-4">
                    <p className="font-bold" style={{
                      color: 'var(--color-fg-primary)',
                      fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-32)'
                    }}>
                      {String(yellowWins).padStart(2, '0')}
                    </p>
                    <img src="/team-yellow.png" alt="Time Amarelo" width={126} height={126}
                      style={{ objectFit: 'contain' }} />
                  </div>
                </div>

                {/* Divider */}
                <div style={{ height: 1, background: 'var(--color-border)' }} />

                {/* Histórico */}
                {history.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <p className="font-semibold" style={{
                      color: 'var(--color-fg-primary)',
                      fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)'
                    }}>
                      Histórico
                    </p>
                    {[...history].map((entry, i) => ({ entry, originalIndex: i }))
                      .reverse()
                      .map(({ entry, originalIndex }) => {
                        const blueWon = entry.blue > entry.yellow
                        const yellowWon = entry.yellow > entry.blue
                        const dateStr = format(new Date(entry.date), "d MMM", { locale: ptBR })
                        return (
                          <div key={originalIndex}
                            className="flex items-center px-4 py-4 rounded-3xl gap-2"
                            style={{ background: 'var(--color-surface-primary)' }}>
                            <div className="flex items-center gap-2 flex-1">
                              <img src="/team-blue.png" alt="Azul" width={26} height={26}
                                style={{ objectFit: 'contain' }} />
                              <p className="font-medium" style={{
                                color: blueWon ? 'var(--color-fg-accent)' : 'var(--color-fg-secondary)',
                                fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)'
                              }}>
                                {entry.blue}
                              </p>
                            </div>
                            <p style={{
                              color: 'var(--color-fg-secondary)',
                              fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-11)'
                            }}>
                              {dateStr}
                            </p>
                            <div className="flex items-center gap-2 flex-1 justify-end">
                              <p className="font-medium" style={{
                                color: yellowWon ? '#b8860b' : 'var(--color-fg-secondary)',
                                fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)'
                              }}>
                                {entry.yellow}
                              </p>
                              <img src="/team-yellow.png" alt="Amarelo" width={26} height={26}
                                style={{ objectFit: 'contain' }} />
                            </div>
                            {isAdmin && (
                              <button
                                onClick={() => deleteEntry.mutate(originalIndex)}
                                disabled={deleteEntry.isPending}
                                className="ml-1 flex items-center justify-center disabled:opacity-40"
                                style={{ width: 14, height: 14, flexShrink: 0 }}>
                                <TrashSimple size={14} weight="bold" color="var(--color-fg-secondary)" />
                              </button>
                            )}
                          </div>
                        )
                      })}
                  </div>
                )}

                {history.length === 0 && (
                  <p className="text-center py-8" style={{
                    color: 'var(--color-fg-secondary)',
                    fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)'
                  }}>
                    Nenhum jogo registrado ainda
                  </p>
                )}
              </>
            )}
          </>
        )}

        {/* ── Aba Jogador ── */}
        {activeTab === 'jogador' && <JogadorTab />}
      </div>

      {/* Botão fixo Adicionar Placar — só na aba Placar para admins */}
      {activeTab === 'placar' && isAdmin && (
        <div className="fixed inset-x-0 px-6 pt-4 pb-3"
          style={{
            bottom: 'calc(var(--bottom-nav-height) + env(safe-area-inset-bottom))',
            background: 'var(--color-bg)',
            backdropFilter: 'blur(12px)',
            borderTop: '1px solid var(--color-border)'
          }}>
          <button
            onClick={() => setShowSheet(true)}
            className="w-full py-4 font-medium transition-all active:scale-95"
            style={{
              background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-fg)',
              borderRadius: 'var(--radius-pill)',
              fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)'
            }}>
            Adicionar Placar
          </button>
        </div>
      )}

      {/* Bottom Sheet — Adicionar Placar */}
      {showSheet && (
        <div className="fixed inset-0 z-[100] flex items-end"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={() => setShowSheet(false)}>
          <div className="w-full rounded-t-3xl flex flex-col gap-6 pt-6 pb-10 px-6"
            style={{ background: 'var(--color-bg)' }}
            onClick={e => e.stopPropagation()}>

            <div className="flex items-center justify-between">
              <p className="font-semibold" style={{
                color: 'var(--color-fg-primary)',
                fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)'
              }}>
                Adicionar placar
              </p>
              <button onClick={() => setShowSheet(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full"
                style={{ background: 'var(--color-surface-primary)' }}>
                <X size={16} color="var(--color-fg-secondary)" />
              </button>
            </div>

            <div className="flex items-center justify-between px-5 py-6 rounded-[20px]"
              style={{ background: 'var(--color-surface-primary)' }}>
              <div className="flex flex-col items-center gap-4">
                <input type="number" inputMode="numeric" value={blueGoals}
                  onChange={e => setBlueGoals(e.target.value)}
                  placeholder="00" min={0}
                  className="text-center font-bold outline-none w-[82px] rounded-2xl"
                  style={{
                    background: 'white', color: 'var(--color-fg-primary)',
                    fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-32)',
                    padding: '8px 12px', border: '2px solid var(--color-border)'
                  }} />
                <img src="/team-blue.png" alt="Time Azul" width={96} height={96}
                  style={{ objectFit: 'contain' }} />
              </div>
              <p className="font-bold" style={{
                color: 'var(--color-fg-primary)',
                fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-32)'
              }}>x</p>
              <div className="flex flex-col items-center gap-4">
                <input type="number" inputMode="numeric" value={yellowGoals}
                  onChange={e => setYellowGoals(e.target.value)}
                  placeholder="00" min={0}
                  className="text-center font-bold outline-none w-[82px] rounded-2xl"
                  style={{
                    background: 'white', color: 'var(--color-fg-primary)',
                    fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-32)',
                    padding: '8px 12px', border: '2px solid var(--color-border)'
                  }} />
                <img src="/team-yellow.png" alt="Time Amarelo" width={96} height={96}
                  style={{ objectFit: 'contain' }} />
              </div>
            </div>

            <button
              onClick={() => saveScore.mutate()}
              disabled={saveScore.isPending || blueGoals === '' || yellowGoals === ''}
              className="w-full py-4 font-medium transition-all active:scale-95 disabled:opacity-40"
              style={{
                background: 'var(--color-surface-accent)', color: 'white',
                borderRadius: 'var(--radius-pill)',
                fontFamily: 'var(--font-primary)', fontSize: 'var(--font-size-16)'
              }}>
              {saveScore.isPending ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

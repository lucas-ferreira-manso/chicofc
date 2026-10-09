import type { RankingEntry } from '../../lib/playerStats'

// Grid do detalhe do jogador: uma linha de jogos (V/E/D/Presenças) e uma linha
// com as quatro categorias da votação. minmax(0, 1fr) mantém as 4 colunas iguais
// mesmo em telas estreitas — com 1fr o conteúdo alarga a coluna e empurra o resto.
export default function PlayerStatsGrid({ entry }: { entry: RankingEntry }) {
  const rows = [
    [
      { label: 'Vitórias', value: entry.wins },
      { label: 'Empates', value: entry.draws },
      { label: 'Derrotas', value: entry.losses },
      { label: 'Presenças', value: entry.presences },
    ],
    [
      { label: 'Bola Cheia', value: entry.bolaCheiaWins },
      { label: 'Bola Murcha', value: entry.bolaMurchaWins },
      { label: 'Prêmio Lúcio', value: entry.melhorDefensorWins },
      { label: 'Rodrigo Caio', value: entry.piorDefensorWins },
    ],
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.map((row, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
          {row.map(s => (
            <div key={s.label} style={{ background: 'var(--color-surface-primary)', borderRadius: 16, padding: 12, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 4, minHeight: 76, minWidth: 0 }}>
              <p style={{ fontFamily: 'var(--font-primary)', fontSize: 11, color: 'var(--color-fg-secondary)', lineHeight: '12px', overflowWrap: 'break-word' }}>{s.label}</p>
              <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 700, fontSize: 24, color: 'var(--color-fg-primary)', lineHeight: 1 }}>{s.value}</p>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

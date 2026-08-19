import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { ArrowClockwise } from '@phosphor-icons/react'
import { db } from '../lib/firebase'
import { useAuthStore } from '../store/authStore'

// Versão do bundle atualmente carregado (injetada no build pelo Vite:
// major.minor.commitCount — única e crescente a cada deploy).
const RUNNING_VERSION = __APP_VERSION__

/** Compara versões "a.b.c" numericamente: >0 se a>b, <0 se a<b, 0 se iguais. */
function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(n => parseInt(n, 10) || 0)
  const pb = b.split('.').map(n => parseInt(n, 10) || 0)
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (diff !== 0) return diff > 0 ? 1 : -1
  }
  return 0
}

async function fetchDbVersion(): Promise<string | null> {
  const snap = await getDoc(doc(db, 'config', 'app'))
  return snap.exists() ? ((snap.data().version as string | undefined) ?? null) : null
}

/** Força a busca de assets novos: derruba service worker + caches e recarrega. */
async function forceReload() {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map(r => r.unregister().catch(() => {})))
    }
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map(k => caches.delete(k)))
    }
  } catch {
    // Se limpar cache falhar, o reload abaixo ainda resolve na maioria dos casos.
  }
  window.location.reload()
}

/**
 * Aviso global de "nova versão disponível".
 *
 * - `config/app.version` no Firestore guarda a versão do último deploy.
 * - Um admin rodando um build mais novo registra essa versão no banco
 *   (pelas regras do Firestore só admin escreve em config/*).
 * - Qualquer usuário cujo bundle esteja ATRASADO em relação ao banco vê o
 *   banner e pode forçar o refresh.
 */
export default function UpdateBanner() {
  const user = useAuthStore(s => s.user)
  const isAdmin = user?.role === 'admin'
  const qc = useQueryClient()

  const { data: dbVersion } = useQuery({
    queryKey: ['app-version'],
    queryFn: fetchDbVersion,
    enabled: !!user,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    staleTime: 0,
  })

  // Admin no build mais novo publica a versão no banco (nunca faz downgrade).
  useEffect(() => {
    if (!isAdmin || dbVersion === undefined) return
    const shouldRegister = dbVersion === null || compareVersions(RUNNING_VERSION, dbVersion) > 0
    if (!shouldRegister) return
    setDoc(
      doc(db, 'config', 'app'),
      { version: RUNNING_VERSION, updatedAt: new Date().toISOString() },
      { merge: true }
    )
      .then(() => qc.invalidateQueries({ queryKey: ['app-version'] }))
      .catch(() => {})
  }, [isAdmin, dbVersion, qc])

  // Só avisa quando o banco está À FRENTE do bundle atual — evita avisar quem
  // já está no build mais recente antes de um admin registrar a versão.
  const updateAvailable = !!dbVersion && compareVersions(dbVersion, RUNNING_VERSION) > 0
  if (!updateAvailable) return null

  return (
    <div
      role="alert"
      style={{
        position: 'fixed', left: 16, right: 16,
        bottom: 'calc(96px + env(safe-area-inset-bottom))',
        zIndex: 100, display: 'flex', alignItems: 'center', gap: 12,
        padding: '14px 16px', borderRadius: 16,
        background: 'var(--color-fg-primary)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
        maxWidth: 480, marginInline: 'auto',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 600, fontSize: 14, color: 'var(--color-bg)', lineHeight: '18px' }}>
          Nova versão disponível
        </p>
        <p style={{ fontFamily: 'var(--font-primary)', fontWeight: 400, fontSize: 12, color: 'var(--color-bg)', opacity: 0.7, lineHeight: '16px' }}>
          Atualize para ver as últimas novidades.
        </p>
      </div>
      <button
        onClick={forceReload}
        className="transition-all active:scale-95"
        style={{
          display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
          padding: '10px 16px', borderRadius: 9999,
          background: 'var(--color-fg-accent)', color: 'white', border: 'none',
          cursor: 'pointer', fontFamily: 'var(--font-primary)', fontWeight: 600, fontSize: 14,
        }}
      >
        <ArrowClockwise size={16} weight="bold" />
        Atualizar
      </button>
    </div>
  )
}

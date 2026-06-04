import { useEffect } from 'react'

/**
 * Trava o scroll da página enquanto um modal/sheet estiver aberto.
 * Restaura automaticamente ao desmontar ou quando `lock` vira false.
 */
export function useLockBodyScroll(lock: boolean) {
  useEffect(() => {
    if (!lock) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [lock])
}

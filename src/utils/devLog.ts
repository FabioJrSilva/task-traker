const isDev = import.meta.env.DEV

/**
 * Substitui console.log de diagnóstico em produção.
 * Em desenvolvimento, emite via console.debug.
 * Em produção, é eliminada via tree-shaking.
 */
export function devLog(...args: unknown[]): void {
  if (isDev) {
    console.debug(...args)
  }
}

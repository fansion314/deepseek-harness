/** Route terminal termination requests through the desktop's owned shutdown. */
import type { EventEmitter } from 'node:events'

/**
 * Coalesce termination signals until the application exits.
 * @param signals - Process signal emitter.
 * @param quit - Starts shutdown without an interactive task confirmation.
 * @returns Disposer removing both signal listeners.
 */
export function installDesktopTermination(signals: Pick<EventEmitter, 'on' | 'off'>, quit: () => void): () => void {
  let requested = false
  const stop = (): void => {
    if (requested) return
    requested = true
    quit()
  }
  signals.on('SIGINT', stop)
  signals.on('SIGTERM', stop)
  return () => { signals.off('SIGINT', stop); signals.off('SIGTERM', stop) }
}

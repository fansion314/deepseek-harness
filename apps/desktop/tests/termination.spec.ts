import { EventEmitter } from 'node:events'
import { expect, it, vi } from 'vitest'
import { installDesktopTermination } from '../src/termination.ts'

it.each(['SIGINT', 'SIGTERM'])('joins repeated %s requests and removes its listeners on disposal', (signal) => {
  const signals = new EventEmitter()
  const quit = vi.fn()
  const dispose = installDesktopTermination(signals, quit)
  signals.emit(signal)
  signals.emit('SIGTERM')
  signals.emit('SIGINT')
  expect(quit).toHaveBeenCalledOnce()
  dispose()
  expect(signals.listenerCount('SIGINT')).toBe(0)
  expect(signals.listenerCount('SIGTERM')).toBe(0)
})

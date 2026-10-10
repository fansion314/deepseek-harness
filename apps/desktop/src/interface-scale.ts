/** Serialized, device-local workspace zoom persisted before it is applied. */
import { readFile } from 'node:fs/promises'
import { writeFileAtomic } from '@deepseek-ai/dsh-atomic-write'
import type { DesktopScaleState } from '@deepseek-ai/dsh-client-ui-settings-general/types'

const FACTORS = Object.freeze([0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2])

function factor(value: unknown): number {
  if (typeof value !== 'number' || !FACTORS.includes(value)) throw new Error('desktop scale: unsupported zoom factor')
  return value
}

/** One main-process preference writer for all trusted workspace renderers. */
export class DesktopInterfaceScale {
  private current = 1
  private pending = Promise.resolve()

  /**
   * @param path - Main-owned preference path.
   * @param publish - Applies and announces committed changes.
   */
  constructor(private readonly path: string, private readonly publish: (state: DesktopScaleState) => void) {}

  /** Current durable preference and fixed user-facing choices. */
  get state(): DesktopScaleState { return { factor: this.current, options: FACTORS } }

  /** Load the preference before creating the application window; missing files use 100%. */
  async load(): Promise<void> {
    let raw: string
    try { raw = await readFile(this.path, 'utf8') } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
      throw error
    }
    const value: unknown = JSON.parse(raw)
    if (typeof value !== 'object' || value === null || !('factor' in value)) throw new Error('desktop scale: invalid preference file')
    this.current = factor(value.factor)
  }

  /**
   * Persist one supported workspace zoom before applying it.
   * @param value - Untrusted IPC input.
   * @returns The committed state; failed writes retain the previous preference.
   */
  set(value: unknown): Promise<DesktopScaleState> {
    const next = factor(value)
    const operation = this.pending.then(async () => {
      await writeFileAtomic(this.path, JSON.stringify({ factor: next }) + '\n', { mode: 0o600, dirMode: 0o700 })
      this.current = next
      this.publish(this.state)
      return this.state
    })
    // A rejected request must not prevent the next user request from saving.
    this.pending = operation.then(() => undefined, () => undefined)
    return operation
  }
}

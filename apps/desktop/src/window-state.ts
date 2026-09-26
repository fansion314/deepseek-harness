/** Device-local main-window dimensions, independent of interface zoom and workspace data. */
import { readFile } from 'node:fs/promises'
import { writeFileAtomic } from '@deepseek-ai/dsh-atomic-write'

/** Normal window dimensions in DIP and the last non-minimized maximization state. */
export interface DesktopWindowStateValue {
  readonly width: number
  readonly height: number
  readonly maximized: boolean
}

/** Retain window geometry in memory and atomically persist it on close or application exit. */
export class DesktopWindowState {
  private current: DesktopWindowStateValue = { width: 1280, height: 820, maximized: false }
  private pending = Promise.resolve()
  private observed = false

  /** @param path - Preference file under Electron userData. */
  constructor(private readonly path: string) {}

  /** Most recently observed normal dimensions and maximization state. */
  get state(): DesktopWindowStateValue { return this.current }

  /** Read saved dimensions before creating the main window; a missing file keeps the defaults. */
  async load(): Promise<void> {
    let raw: string
    try { raw = await readFile(this.path, 'utf8') } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
      throw error
    }
    const value: unknown = JSON.parse(raw)
    if (typeof value !== 'object' || value === null
      || !('width' in value) || typeof value.width !== 'number' || !Number.isSafeInteger(value.width) || value.width <= 0
      || !('height' in value) || typeof value.height !== 'number' || !Number.isSafeInteger(value.height) || value.height <= 0
      || !('maximized' in value) || typeof value.maximized !== 'boolean') {
      throw new Error('desktop window: invalid saved dimensions')
    }
    this.current = { width: value.width, height: value.height, maximized: value.maximized }
  }

  /**
   * Limit startup dimensions to the current display's work area.
   * @param workArea - Available width and height in DIP.
   * @returns Initial normal window dimensions.
   */
  dimensions(workArea: { width: number; height: number }): { width: number; height: number } {
    return { width: Math.min(this.current.width, workArea.width), height: Math.min(this.current.height, workArea.height) }
  }

  /**
   * Retain a native window observation without writing during resize events.
   * @param value - Normal dimensions and maximization state of a visible, non-minimized, non-fullscreen window.
   */
  capture(value: DesktopWindowStateValue): void { this.current = value; this.observed = true }

  /**
   * Save the current observation after preceding writes; startup cancellation without an observation leaves the file unchanged.
   * Failures preserve the previous file and allow retry.
   * @returns Completion of the atomic replacement, including any preceding saves.
   */
  save(): Promise<void> {
    if (!this.observed) return this.pending
    const content = JSON.stringify(this.current) + '\n'
    const operation = this.pending.then(() => writeFileAtomic(this.path, content, { mode: 0o600, dirMode: 0o700 }))
    this.pending = operation.catch(() => undefined)
    return operation
  }
}

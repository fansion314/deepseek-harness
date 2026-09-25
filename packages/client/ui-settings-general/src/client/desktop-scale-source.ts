/** Desktop zoom observation and save outcomes shared by its row and notification. */
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { DesktopScaleBridge, DesktopScaleState } from '../types.ts'

interface View {
  state?: DesktopScaleState
  loading: boolean
  failed: boolean
  saving: boolean
  notice?: { id: number; saved: boolean } | undefined
}

/** Owns the desktop subscription while the settings plugin is active. */
export class DesktopScaleSource {
  /** Accepted preference and operation feedback observed by the slot renderer. */
  readonly store = createSnapshotStore<View>({ loading: true, failed: false, saving: false })
  private live = true
  private revision = 0
  private noticeId = 0
  private readonly unsubscribe: () => void

  /** @param bridge - Trusted desktop preference operations. */
  constructor(private readonly bridge: DesktopScaleBridge) {
    this.unsubscribe = bridge.subscribe((state) => {
      if (!this.live) return
      this.revision += 1
      this.store.set({ ...this.store.getSnapshot(), state, loading: false, failed: false })
    })
    void this.load()
  }

  /** Read or retry the current preference without replacing a newer event. */
  load(): Promise<void> {
    if (!this.live) return Promise.resolve()
    const revision = this.revision
    this.store.set({ ...this.store.getSnapshot(), loading: true, failed: false })
    return this.bridge.status().then((state) => {
      if (this.live && this.revision === revision) this.store.set({ ...this.store.getSnapshot(), state, loading: false })
    }, (_error: unknown) => {
      // Loading remains retryable when the carrier request fails.
      if (this.live && this.revision === revision) this.store.set({ ...this.store.getSnapshot(), loading: false, failed: true })
    })
  }

  /**
   * Save one selection and report its outcome after the desktop commits it.
   * @param factor - User-selected supported factor.
   */
  set(factor: number): Promise<void> {
    if (!this.live || this.store.getSnapshot().saving) return Promise.resolve()
    const revision = this.revision
    this.store.set({ ...this.store.getSnapshot(), saving: true, notice: undefined })
    return this.bridge.set(factor).then((state) => {
      if (this.live) this.store.set({ ...this.store.getSnapshot(),
        ...this.revision === revision ? { state } : {}, saving: false, notice: { id: ++this.noticeId, saved: true } })
    }, (_error: unknown) => {
      // The previous accepted factor stays selected; a shell overlay reports the failed write.
      if (this.live) this.store.set({ ...this.store.getSnapshot(), saving: false, notice: { id: ++this.noticeId, saved: false } })
    })
  }

  /**
   * Clear only the notification whose animation completed.
   * @param id - Notification identity.
   */
  dismiss(id: number): void {
    if (this.live && this.store.getSnapshot().notice?.id === id) this.store.set({ ...this.store.getSnapshot(), notice: undefined })
  }

  /** Detach the bridge and ignore outstanding requests after plugin disposal. */
  dispose(): void { this.live = false; this.unsubscribe() }
}

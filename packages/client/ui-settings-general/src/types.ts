/** Type-only Electron update declarations shared by the settings UI and Desktop compatibility checks. */

/** Classified failure copy selected by the Web locale without exposing raw updater diagnostics. */
export type DesktopUpdateFailureKind =
  | 'check'
  | 'check-network'
  | 'download'
  | 'download-network'
  | 'install'
  | 'install-network'
  | 'stop-failed'
  | 'tasks-changed'
  | 'tasks-unavailable'

/** Public semantic preload fields consumed by the settings row. */
export interface DesktopUpdatePresentation {
  readonly phase: 'idle' | 'checking' | 'available' | 'downloading' | 'verifying' | 'installing' | 'ready' | 'error'
  readonly version?: string
  readonly percent?: number
  readonly failure?: DesktopUpdateFailureKind
}

/** Optional carrier API; it cannot select artifacts or authorize installation. */
export interface DesktopUpdateBridge {
  status(): Promise<DesktopUpdatePresentation>
  open(): Promise<void>
  subscribe(listener: (state: DesktopUpdatePresentation) => void): () => void
}

/** Shared carrier status for the account row and collapsed sidebar badge. */
export interface DesktopUpdateView {
  readonly presentation?: DesktopUpdatePresentation
  readonly failed: boolean
  readonly opening: boolean
}

/** Device-local workspace zoom and the factors accepted by the desktop shell. */
export interface DesktopScaleState {
  readonly factor: number
  readonly options: readonly number[]
}

/** Optional desktop-only zoom control; preference files remain main-process-owned. */
export interface DesktopScaleBridge {
  /** @returns The persisted zoom and supported choices. */
  status(): Promise<DesktopScaleState>
  /**
   * @param factor - A supported zoom factor.
   * @returns The state after durable storage and application.
   */
  set(factor: number): Promise<DesktopScaleState>
  /**
   * @param listener - Receives committed zoom changes.
   * @returns Subscription disposer.
   */
  subscribe(listener: (state: DesktopScaleState) => void): () => void
}

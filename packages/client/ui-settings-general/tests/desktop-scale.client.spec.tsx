// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useSyncExternalStore } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import type { DesktopScaleBridge, DesktopScaleState } from '../src/types.ts'
import { DesktopScaleSource } from '../src/client/desktop-scale-source.ts'
import { DesktopScaleRow, DesktopScaleNotice } from '../src/client/DesktopScaleRow.tsx'
import { en, zh } from '../src/client/locales.ts'
import type { GlobalStandardProps, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'

afterEach(cleanup)
const initial = { factor: 1, options: [0.75, 1, 1.25, 1.5, 2] }
const unused = (): never => { throw new Error('Unused standard hook in scale controls') }
const kit: GlobalStandardProps = { usePanelInfo: unused, useSessions: unused, useSessionStatus: unused,
  useSessionRetainInfo: unused, useResource: unused, useWorkspaces: unused }

function fixture() {
  let listener: ((state: DesktopScaleState) => void) | undefined
  const status = Promise.withResolvers<DesktopScaleState>()
  const unsubscribe = vi.fn()
  const set = vi.fn<DesktopScaleBridge['set']>(async factor => ({ ...initial, factor }))
  const bridge: DesktopScaleBridge = { status: () => status.promise, set,
    subscribe: (next) => { listener = next; return unsubscribe } }
  const source = new DesktopScaleSource(bridge)
  const subscribe = (notify: () => void) => source.store.subscribe(notify)
  const snapshot = () => source.store.getSnapshot()
  return { source, status, set, unsubscribe, emit: (state: DesktopScaleState) => { listener?.(state) },
    Component: ({ dictionary = zh }: { dictionary?: typeof zh | typeof en }) => {
      const view = useSyncExternalStore(subscribe, snapshot)
      const messages: Readonly<Record<string, string>> = dictionary
      const t: PropsLocale<'settings'>['t'] = key => messages[key] ?? key
      const props = { ...kit, t, useScale: <T,>(select: (value: typeof view) => T) => select(view),
        setScale: (factor: number) => { void source.set(factor) }, retry: () => { void source.load() },
        dismiss: (id: number) => { source.dismiss(id) } }
      return <><DesktopScaleRow {...props} /><DesktopScaleNotice {...props} /></>
    } }
}

it('renders localized choices, saves the selection and reports the accepted value', async () => {
  const f = fixture()
  const view = render(<f.Component />)
  try {
    await act(async () => { f.status.resolve(initial) })
    fireEvent.click(screen.getByRole('button', { name: '界面缩放' }))
    fireEvent.click(screen.getByRole('menuitem', { name: '150%' }))
    await act(async () => {})
    expect(f.set).toHaveBeenCalledWith(1.5)
    expect(screen.getByRole('button', { name: '界面缩放' }).textContent).toContain('150%')
    expect(screen.getByRole('alert').textContent).toBe('界面缩放已保存')
    view.rerender(<f.Component dictionary={en} />)
    expect(screen.getByRole('button', { name: 'Interface scale' }).textContent).toContain('150%')
  } finally { f.source.dispose(); view.unmount() }
})

it('retains a newer event over initial status and keeps failed saves retryable', async () => {
  const f = fixture()
  try {
    f.emit({ ...initial, factor: 1.25 })
    f.status.resolve(initial)
    await Promise.resolve()
    expect(f.source.store.getSnapshot().state?.factor).toBe(1.25)
    f.set.mockRejectedValueOnce(new Error('disk full'))
    await f.source.set(1.5)
    expect(f.source.store.getSnapshot()).toMatchObject({ state: { factor: 1.25 }, notice: { saved: false }, saving: false })
    await f.source.set(1.5)
    expect(f.source.store.getSnapshot()).toMatchObject({ state: { factor: 1.5 }, notice: { saved: true } })
  } finally { f.source.dispose() }
  expect(f.unsubscribe).toHaveBeenCalledOnce()
})

it('ignores pending reads and writes after the settings plugin is disposed', async () => {
  const f = fixture()
  const write = Promise.withResolvers<DesktopScaleState>()
  f.set.mockReturnValueOnce(write.promise)
  const operation = f.source.set(1.5)
  f.source.dispose()
  const state = f.source.store.getSnapshot()
  f.status.resolve(initial)
  write.resolve({ ...initial, factor: 1.5 })
  await operation
  expect(f.source.store.getSnapshot()).toBe(state)
})

it('keeps a newer committed event when an earlier write response arrives late', async () => {
  const f = fixture()
  const write = Promise.withResolvers<DesktopScaleState>()
  try {
    f.status.resolve(initial)
    await Promise.resolve()
    f.set.mockReturnValueOnce(write.promise)
    const operation = f.source.set(1.25)
    f.emit({ ...initial, factor: 1.5 })
    write.resolve({ ...initial, factor: 1.25 })
    await operation
    expect(f.source.store.getSnapshot().state?.factor).toBe(1.5)
  } finally { f.source.dispose() }
})

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { expect, it, onTestFinished } from 'vitest'
import { DesktopWindowState } from '../src/window-state.ts'

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-window-state-'))
  onTestFinished(() => rm(directory, { recursive: true, force: true }))
  const path = join(directory, 'window-state.json')
  return { path, state: new DesktopWindowState(path) }
}

it('restores normal dimensions and maximization, limiting dimensions to a smaller display', async () => {
  const { path, state } = await fixture()
  await state.load()
  expect(state.state).toEqual({ width: 1280, height: 820, maximized: false })
  state.capture({ width: 1440, height: 900, maximized: true })
  await state.save()
  const restarted = new DesktopWindowState(path)
  await restarted.load()
  expect(restarted.state).toEqual({ width: 1440, height: 900, maximized: true })
  expect(restarted.dimensions({ width: 1920, height: 1080 })).toEqual({ width: 1440, height: 900 })
  expect(restarted.dimensions({ width: 1024, height: 768 })).toEqual({ width: 1024, height: 768 })
})

it('orders overlapping saves so the last observed size wins', async () => {
  const { path, state } = await fixture()
  state.capture({ width: 1100, height: 700, maximized: false })
  const first = state.save()
  state.capture({ width: 1200, height: 800, maximized: false })
  await Promise.all([first, state.save()])
  expect(JSON.parse(await readFile(path, 'utf8'))).toEqual({ width: 1200, height: 800, maximized: false })
})

it.each([null, {}, { width: -1, height: 800, maximized: false }, { width: 1200, height: 0.5, maximized: false },
  { width: 1200, height: 800, maximized: 'true' }])('rejects invalid saved dimensions: %j', async (value) => {
  const { path, state } = await fixture()
  await writeFile(path, JSON.stringify(value))
  await expect(state.load()).rejects.toThrow('invalid saved dimensions')
})

it('allows saving again after a write failure', async () => {
  const { path } = await fixture()
  await writeFile(path, 'not a directory')
  const state = new DesktopWindowState(join(path, 'window-state.json'))
  state.capture({ width: 1280, height: 820, maximized: false })
  await expect(state.save()).rejects.toThrow()
  await rm(path)
  await state.save()
  expect(JSON.parse(await readFile(join(path, 'window-state.json'), 'utf8'))).toEqual(state.state)
})

it('does not overwrite saved geometry when startup exits before showing a window', async () => {
  const { path, state } = await fixture()
  const saved = { width: 1500, height: 950, maximized: true }
  await writeFile(path, JSON.stringify(saved))
  await state.save()
  expect(JSON.parse(await readFile(path, 'utf8'))).toEqual(saved)
})

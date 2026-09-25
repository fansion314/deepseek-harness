import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it, onTestFinished, vi } from 'vitest'
import { DesktopInterfaceScale } from '../src/interface-scale.ts'
import type { DesktopScaleState } from '@deepseek-ai/dsh-client-ui-settings-general/types'

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'desktop-scale-'))
  onTestFinished(() => rm(root, { recursive: true, force: true }))
  const path = join(root, 'interface-scale.json')
  const publish = vi.fn<(state: DesktopScaleState) => void>()
  return { path, publish, scale: new DesktopInterfaceScale(path, publish) }
}

it('defaults to 100%, serializes saves and restores the last committed zoom', async () => {
  const { path, scale, publish } = await fixture()
  await scale.load()
  expect(scale.state.factor).toBe(1)
  await Promise.all([scale.set(1.5), scale.set(1.25)])
  expect(publish.mock.calls.map(([state]) => state.factor)).toEqual([1.5, 1.25])
  expect(JSON.parse(await readFile(path, 'utf8'))).toEqual({ factor: 1.25 })
  const restarted = new DesktopInterfaceScale(path, vi.fn())
  await restarted.load()
  expect(restarted.state.factor).toBe(1.25)
})

it('rejects unsupported IPC and file values without applying them', async () => {
  const { path, scale, publish } = await fixture()
  expect(() => scale.set('1.5')).toThrow('unsupported')
  expect(() => scale.set(5)).toThrow('unsupported')
  await writeFile(path, '{"factor":0}')
  await expect(scale.load()).rejects.toThrow('unsupported')
  await writeFile(path, '{}')
  await expect(scale.load()).rejects.toThrow('invalid preference')
  expect(publish).not.toHaveBeenCalled()
  expect(scale.state.factor).toBe(1)
})

it('retains the previous factor after a failed write and permits retry', async () => {
  const { path, publish } = await fixture()
  await writeFile(path, 'not a directory')
  const scale = new DesktopInterfaceScale(join(path, 'scale.json'), publish)
  await expect(scale.set(1.5)).rejects.toThrow()
  expect(scale.state.factor).toBe(1)
  expect(publish).not.toHaveBeenCalled()
  await rm(path)
  await scale.set(1.5)
  expect(scale.state.factor).toBe(1.5)
})

/** Built settings UI with a controlled desktop preference bridge; real zoom is tested by the Arch shell smoke. */
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { chromium } from 'playwright'
import { expect, it, onTestFinished } from 'vitest'
import { captureStableAria, compareOrRefreshGolden, launchWebScaffold, webSnapshotMode } from './scaffold.ts'
import { openSettings, ZH_BROWSER_LOCALE } from './support.ts'

const EXPECTED = fileURLToPath(new URL('./expected/desktop-scale', import.meta.url))

it('shows desktop scale choices and preserves the selection across reopening Settings', async () => {
  const scaffold = await launchWebScaffold({})
  onTestFinished(() => scaffold.close())
  await scaffold.ctx.settings.mutate('ui-settings-account', [
    { op: 'set', path: ['step'], value: 'done' },
    { op: 'set', path: ['completion'], value: 'completed' },
  ])
  const browser = await chromium.launch()
  onTestFinished(() => browser.close())
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, locale: ZH_BROWSER_LOCALE })
  await page.addInitScript(() => {
    const options = [0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2]
    let state = { factor: 1, options }
    const listeners = new Set<(value: typeof state) => void>()
    Object.assign(globalThis, { dshDesktop: { protocolVersion: 1, scale: {
      status: async () => state,
      set: async (factor: number) => { state = { factor, options }; for (const listener of listeners) listener(state); return state },
      subscribe: (listener: (value: typeof state) => void) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    } } })
  })
  await page.goto(scaffold.authenticatedUrl, { waitUntil: 'load' })
  await openSettings(page, 'zh')
  const dialog = page.getByRole('dialog', { name: '设置', exact: true })
  await dialog.getByRole('button', { name: '通用设置', exact: true }).click()
  const selector = dialog.getByRole('button', { name: '界面缩放', exact: true })
  await selector.click()
  await compareOrRefreshGolden(join(EXPECTED, 'choices.expected.md'),
    await captureStableAria(page, '[role="menu"]', scaffold.workspaceCwd), webSnapshotMode())
  await page.getByRole('menuitem', { name: '150%', exact: true }).click()
  await expect.poll(() => selector.innerText()).toBe('150%')
  await page.keyboard.press('Escape')
  await openSettings(page, 'zh')
  await dialog.getByRole('button', { name: '通用设置', exact: true }).click()
  expect(await selector.innerText()).toBe('150%')
})

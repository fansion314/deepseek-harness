/** Exercise real desktop zoom, persistence, window close and terminal termination with isolated user state. */
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, readlink, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const { _electron: electron } = createRequire(new URL('../apps/web/package.json', import.meta.url))('playwright')
const appRoot = resolve(process.argv[2] ?? '.arch-build/root/usr/lib/dsh-electron')
const scratch = await mkdtemp(join(tmpdir(), 'dsh-arch-shell-'))
const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/(?:KEY|SECRET|TOKEN|PASSWORD|^DSH_|^ELECTRON_)/iu.test(name)))
const evidence = process.env.DSH_ARCH_SCREENSHOTS
let application
let exited
let child

async function launch() {
  application = await electron.launch({ executablePath: resolve(appRoot, '../../bin/dsh-electron'),
    args: [`--user-data-dir=${join(scratch, 'chromium')}`, '--lang=en-US'], timeout: 60_000,
    env: { ...env, DSH_HOME: join(scratch, 'dsh'), DSH_AGENTS_HOME: join(scratch, 'agents'), XDG_CACHE_HOME: join(scratch, 'cache') } })
  child = application.process()
  exited = new Promise(resolveExit => { child.once('exit', (code, signal) => { resolveExit({ code, signal }) }) })
  const welcome = application.windows().find(page => page.url().endsWith('/renderer/welcome.html'))
    ?? await application.waitForEvent('window', {
      predicate: async page => { await page.waitForURL('**/renderer/welcome.html', { timeout: 60_000 }); return true },
      timeout: 60_000,
    })
  await welcome.locator('#api-key').click()
  await welcome.locator('#skip-key').click()
  const main = application.windows().find(page => page.url().startsWith('dsh-app://app/'))
  assert.ok(main)
  await main.getByRole('button', { name: 'Account menu', exact: true }).waitFor()
  return main
}

async function screenshot(name) {
  await mkdir(evidence, { recursive: true })
  const png = await application.evaluate(async ({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows().find(window => window.webContents.getURL().startsWith('dsh-app://app/'))
    return (await window.webContents.capturePage()).toPNG().toString('base64')
  })
  await writeFile(join(evidence, name), Buffer.from(png, 'base64'))
}

async function waitForExit() {
  let timer
  try {
    const outcome = await Promise.race([exited, new Promise((_, reject) => {
      timer = setTimeout(() => { reject(new Error('Desktop did not exit within 30 seconds')) }, 30_000)
    })])
    assert.deepEqual(outcome, { code: 0, signal: null })
  } finally { clearTimeout(timer) }
}

async function hostPids() {
  const pids = (await readFile(`/proc/${child.pid}/task/${child.pid}/children`, 'utf8')).trim().split(/\s+/).filter(Boolean)
  const hosts = []
  for (const pid of pids) {
    try { if (await readlink(`/proc/${pid}/exe`) === '/usr/bin/node') hosts.push(Number(pid)) }
    catch (error) { if (error.code !== 'ENOENT') throw error }
  }
  assert.equal(hosts.length, 1)
  return hosts
}

try {
  const main = await launch()
  await main.getByRole('button', { name: 'Account menu', exact: true }).click()
  await main.getByRole('menuitem', { name: 'Settings', exact: true }).click()
  const dialog = main.getByRole('dialog', { name: 'Settings', exact: true })
  await dialog.getByRole('button', { name: 'General', exact: true }).click()
  const scale = dialog.getByRole('button', { name: 'Interface scale', exact: true })
  assert.equal((await scale.innerText()).trim(), '100%')
  for (const palette of ['Light', 'Dark']) {
    await dialog.getByRole('button', { name: palette, exact: true }).click()
    await main.waitForFunction(dark => document.body.hasAttribute('data-ds-dark-theme') === dark, palette === 'Dark')
    await scale.click()
    const menu = main.getByRole('menu')
    const bounds = await menu.boundingBox()
    const viewport = await main.evaluate(() => ({ width: innerWidth, height: innerHeight }))
    assert.ok(bounds && bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= viewport.width && bounds.y + bounds.height <= viewport.height)
    if (evidence) await screenshot(`scale-${palette.toLowerCase()}.png`)
    await main.keyboard.press('Escape')
    assert.equal(await menu.count(), 0)
  }
  await scale.click()
  await main.getByRole('menuitem', { name: '150%', exact: true }).click()
  await main.waitForFunction(() => document.querySelector('[aria-label="Interface scale"]')?.textContent?.includes('150%'))
  assert.equal(await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()
    .find(window => window.webContents.getURL().startsWith('dsh-app://app/')).webContents.getZoomFactor()), 1.5)
  assert.deepEqual(JSON.parse(await readFile(join(scratch, 'chromium/interface-scale.json'), 'utf8')), { factor: 1.5 })
  await scale.scrollIntoViewIfNeeded()
  const panel = await dialog.boundingBox()
  const viewport = await main.evaluate(() => ({ width: innerWidth, height: innerHeight }))
  assert.ok(panel && panel.x >= 0 && panel.y >= 0 && panel.x + panel.width <= viewport.width && panel.y + panel.height <= viewport.height)
  if (evidence) await screenshot('scale-150.png')
  const hosts = await hostPids()
  await main.keyboard.press('Escape')
  const window = await application.browserWindow(main)
  await window.evaluate(owner => { owner.close() })
  await waitForExit()
  for (const pid of hosts) assert.equal(existsSync(`/proc/${pid}`), false, 'Host exited after window close')
  application = undefined

  await launch()
  assert.equal(await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()
    .find(window => window.webContents.getURL().startsWith('dsh-app://app/')).webContents.getZoomFactor()), 1.5)
  const restartedHosts = await hostPids()
  const stat = await readFile(`/proc/${child.pid}/stat`, 'utf8')
  const group = Number(stat.slice(stat.lastIndexOf(')') + 2).split(' ')[2])
  assert.equal(group, child.pid, 'Signal test owns the Electron process group')
  process.kill(-group, 'SIGINT')
  await waitForExit()
  for (const pid of restartedHosts) assert.equal(existsSync(`/proc/${pid}`), false, 'Host exited after terminal SIGINT')
  application = undefined
  console.log('Arch desktop: scale persisted; Linux window close and terminal SIGINT exited cleanly with no remaining Host')
} finally {
  try {
    if (application) {
      await application.evaluate(({ app }) => { app.quit() }).catch(() => {})
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
      await exited
    }
  } finally { await rm(scratch, { recursive: true, force: true }) }
}

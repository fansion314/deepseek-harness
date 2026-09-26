/** Check the Arch adapter against actual pacman-owned interpreters and concurrent launches. */
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { cp, chmod, mkdtemp, mkdir, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { test } from 'node:test'
import { promisify } from 'node:util'

test('concurrent launches reuse metadata and link system runtimes without copying interpreters', async () => {
  const scratch = await mkdtemp(join(tmpdir(), 'dsh-system-runtime-'))
  try {
    const app = join(scratch, 'app')
    await mkdir(join(app, 'runtime/office-skills'), { recursive: true })
    await mkdir(join(app, 'runtime/bin'), { recursive: true })
    await cp('aur/node', join(app, 'runtime/bin/node'))
    await cp('aur/asar-paths.mjs', join(app, 'runtime/asar-paths.mjs'))
    await chmod(join(app, 'runtime/bin/node'), 0o755)
    await cp('apps/desktop/node_modules/pnpm', join(app, 'runtime/pnpm'), { recursive: true, dereference: true })
    await writeFile(join(app, 'package.json'), JSON.stringify({ version: '0.1.7-rc.2' }))
    const args = [resolve('aur/system-runtime.mjs'), app, join(scratch, 'cache')]
    const children = await Promise.allSettled([1, 2].map(() => promisify(execFile)(join(app, 'runtime/bin/node'), args, { timeout: 30_000 })))
    const paths = children.map(result => {
      if (result.status === 'rejected') throw result.reason
      return result.value.stdout.trim()
    })
    assert.equal(paths[0], paths[1])
    const runtime = join(paths[0], 'primary-runtime')
    const manifest = JSON.parse(await readFile(join(runtime, 'runtime.json'), 'utf8'))
    assert.equal(manifest.platform, 'linux')
    assert.equal(Object.keys(manifest.pythonPackages).length, 13)
    assert.equal(await realpath(join(runtime, 'dependencies/python/bin/python3')), await realpath('/usr/bin/python'))
    const node = join(runtime, 'dependencies/node/bin/node')
    assert.equal(await realpath(node), join(app, 'runtime/bin/node'))
    const probe = await promisify(execFile)(node, ['-p', 'JSON.stringify(process.versions)'], { env: {}, timeout: 30_000 })
    const versions = JSON.parse(probe.stdout)
    assert.match(versions.electron, /^44\./)
    assert.equal(manifest.node, versions.node)
    assert.equal(await realpath(join(runtime, 'dependencies/pnpm')), join(app, 'runtime/pnpm'))
    assert.deepEqual(await readdir(join(runtime, 'dependencies/node/bin')), ['node'])
    assert.deepEqual(await readdir(join(scratch, 'cache')), [paths[0].split('/').at(-1)])
  } finally { await rm(scratch, { recursive: true, force: true }) }
})

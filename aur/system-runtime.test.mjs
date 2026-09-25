/** Check the Arch adapter against actual pacman-owned interpreters and concurrent launches. */
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, mkdir, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { test } from 'node:test'
import { promisify } from 'node:util'

test('concurrent launches reuse metadata and link system runtimes without copying interpreters', async () => {
  const scratch = await mkdtemp(join(tmpdir(), 'dsh-system-runtime-'))
  try {
    const app = join(scratch, 'app')
    await mkdir(join(app, 'runtime/office-skills'), { recursive: true })
    await writeFile(join(app, 'package.json'), JSON.stringify({ version: '0.1.7-rc.2' }))
    const args = [resolve('aur/system-runtime.mjs'), app, join(scratch, 'cache')]
    const children = await Promise.allSettled([1, 2].map(() => promisify(execFile)('/usr/bin/node', args, { timeout: 30_000 })))
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
    assert.equal(await realpath(join(runtime, 'dependencies/node/bin/node')), '/usr/bin/node')
    assert.equal(await realpath(join(runtime, 'dependencies/pnpm')), '/usr/lib/node_modules/pnpm')
    assert.deepEqual(await readdir(join(runtime, 'dependencies/node/bin')), ['node'])
    assert.deepEqual(await readdir(join(scratch, 'cache')), [paths[0].split('/').at(-1)])
  } finally { await rm(scratch, { recursive: true, force: true }) }
})

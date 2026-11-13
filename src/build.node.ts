import { beforeAll, describe, expect, it } from 'vitest'
import { execFile } from 'child_process'
import * as fs from 'fs'
import { createRequire } from 'module'
import * as path from 'path'
import { pathToFileURL } from 'url'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

const OUT_DIR = path.resolve('-tmp/-test/build')
const VITE_CLI = path.resolve('node_modules/vite/bin/vite.js')
const WORKER_SCRIPT = path.resolve(
  'src/common/worker/-test/workerMessageLate.ts',
)
const ENTRIES = ['common', 'node', 'browser']

/**
 * Creates and terminates a worker with createWorkerVite of the built library
 * in a new Node.js process. Returns the output of the process: 'terminated' on success.
 * importCode is an expression that returns a promise of the library module.
 * A new process, because vitest transforms the modules that a test imports
 */
async function createWorkerInNode(importCode: string): Promise<string> {
  const { stdout } = await execFileAsync(process.execPath, [
    '-e',
    `${importCode}.then(async ({ createWorkerVite }) => {
      const worker = await createWorkerVite(${JSON.stringify(WORKER_SCRIPT)})
      await worker.terminate()
      console.log('terminated')
    })`,
  ])
  return stdout.trim()
}

describe('build', { timeout: 2 * 60 * 1000 }, () => {
  beforeAll(
    async () => {
      await execFileAsync(
        process.execPath,
        [VITE_CLI, 'build', '--outDir', OUT_DIR, '--logLevel', 'silent'],
        { env: { ...process.env, NODE_ENV: 'production' } },
      )
    },
    2 * 60 * 1000,
  )

  it('cjs and esm entries export the same names', async () => {
    const require = createRequire(import.meta.url)
    for (let i = 0; i < ENTRIES.length; i++) {
      const entry = path.join(OUT_DIR, ENTRIES[i])
      const namesCjs = Object.keys(require(path.join(entry, 'index.cjs')))
      const { stdout } = await execFileAsync(process.execPath, [
        '-e',
        `import(${JSON.stringify(pathToFileURL(path.join(entry, 'index.mjs')).href)})
          .then(o => console.log(JSON.stringify(Object.keys(o))))`,
      ])
      expect(namesCjs.length).toBeGreaterThan(0)
      expect(namesCjs.sort()).toEqual(JSON.parse(stdout).sort())
    }
  })

  it('cjs bundle creates and terminates a vite worker', async () => {
    const file = path.join(OUT_DIR, 'common/index.cjs')
    const result = await createWorkerInNode(
      `Promise.resolve(require(${JSON.stringify(file)}))`,
    )
    expect(result).toBe('terminated')
  })

  it('esm bundle creates and terminates a vite worker', async () => {
    const url = pathToFileURL(path.join(OUT_DIR, 'common/index.mjs')).href
    const result = await createWorkerInNode(`import(${JSON.stringify(url)})`)
    expect(result).toBe('terminated')
  })

  it('contains no test files', async () => {
    const files = await fs.promises.readdir(OUT_DIR, { recursive: true })
    const testFiles = files.filter(o =>
      /\.(test|node|browser|chrome)\.|\.e2e\.(slow|long)\.|[\\/]-test[\\/]/.test(
        o,
      ),
    )
    expect(testFiles).toEqual([])
  })
})

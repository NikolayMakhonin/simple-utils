import { describe, it, expect } from 'vitest'
import { getDateInet } from './getDateInet'

const MODULE_URL = new URL('./getDateInet.ts', import.meta.url).href

// A blob worker is the hardest case of the default url:
// it has no window, and a relative url cannot be resolved against its blob: url
const WORKER_CODE = `
const { getDateInet } = await import(${JSON.stringify(MODULE_URL)})
self.postMessage(await getDateInet())
`

function getDateInetInWorker(): Promise<number> {
  const worker = new Worker(
    URL.createObjectURL(new Blob([WORKER_CODE], { type: 'text/javascript' })),
    { type: 'module' },
  )
  return new Promise<number>((resolve, reject) => {
    worker.onmessage = event => {
      resolve(event.data)
    }
    worker.onerror = event => {
      reject(new Error(`[test][getDateInet] worker error: ${event.message}`))
    }
  }).finally(() => {
    worker.terminate()
  })
}

describe('getDateInet', () => {
  // The test server runs on the same machine, so its date is close to the local clock
  function test(date: number) {
    expect(Math.abs(date - Date.now())).toBeLessThan(60 * 1000)
  }

  it('default url in a page', async () => {
    test(await getDateInet())
  })

  it('default url in a web worker', async () => {
    test(await getDateInetInWorker())
  })
})

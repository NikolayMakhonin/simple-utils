import { describe, it, expect } from 'vitest'
import { isWebWorker } from './helpers'

const MODULE_URL = new URL('./helpers.ts', import.meta.url).href

const WORKER_CODE = `
const { isWebWorker } = await import(${JSON.stringify(MODULE_URL)})
self.postMessage(isWebWorker())
`

describe('isWebWorker', () => {
  it('false in a page', () => {
    expect(isWebWorker()).toBe(false)
  })

  it('true in a web worker', async () => {
    const worker = new Worker(
      URL.createObjectURL(new Blob([WORKER_CODE], { type: 'text/javascript' })),
      { type: 'module' },
    )
    const result = await new Promise((resolve, reject) => {
      worker.onmessage = event => {
        resolve(event.data)
      }
      worker.onerror = event => {
        reject(new Error(`[test][isWebWorker] worker error: ${event.message}`))
      }
    })
    worker.terminate()
    expect(result).toBe(true)
  })
})

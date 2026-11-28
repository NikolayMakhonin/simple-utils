import { describe, it, expect } from 'vitest'
import { errorEventToWorkerError, isWebWorker } from './helpers'

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

describe('errorEventToWorkerError', () => {
  it('a plain Event, as a worker fires when its script fails to load', () => {
    // The DOM types give the error event of a worker as an ErrorEvent
    const error = errorEventToWorkerError(new Event('error') as ErrorEvent)
    expect(error.message).toBe(
      '[errorEventToWorkerError] error event without a message,' +
        ' such as a worker fires when its script fails to load',
    )
  })

  it('an ErrorEvent without an error object gives its message and its place', () => {
    const error = errorEventToWorkerError(
      new ErrorEvent('error', {
        message: 'Uncaught Error: x',
        filename: 'worker.js',
        lineno: 2,
        colno: 3,
      }),
    )
    expect(error.message).toBe('Uncaught Error: x\nworker.js:2:3')
  })

  it('an ErrorEvent with an error object gives its message and the stack', () => {
    const errorThrown = new Error('x')
    const error = errorEventToWorkerError(
      new ErrorEvent('error', {
        message: 'Uncaught Error: x',
        error: errorThrown,
      }),
    )
    expect(error.message).toBe(`Uncaught Error: x\n${errorThrown.stack}`)
  })

  it('an ErrorEvent with a thrown string gives its message and the string', () => {
    const error = errorEventToWorkerError(
      new ErrorEvent('error', { message: 'Uncaught x', error: 'x' }),
    )
    expect(error.message).toBe('Uncaught x\nx')
  })
})

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createWorkerVite } from './createWorkerVite'
import { WorkerError, WorkerErrorType } from '../types'

describe('createWorkerVite', { timeout: 60 * 1000 }, () => {
  // createWorkerVite logs every error of the thread
  beforeAll(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterAll(() => {
    vi.restoreAllMocks()
  })

  it('rejects when the thread fails before ready', async () => {
    const error: Error = await createWorkerVite(
      new URL('../-test/workerThrow.ts', import.meta.url),
    ).then(
      () => {
        throw new Error('[test] createWorkerVite must reject')
      },
      o => o,
    )
    expect(error.message).toBe('test worker error')
    // Vite transforms the file, so only a source map gives its own line
    expect(error.stack).toContain('workerThrow.ts:5:')
  })

  it('rejects on an unexpected message before ready', async () => {
    const error: WorkerError = await createWorkerVite(
      new URL('../-test/workerMessageEarly.ts', import.meta.url),
    ).then(
      () => {
        throw new Error('[test] createWorkerVite must reject')
      },
      o => o,
    )
    expect(error).toBeInstanceOf(WorkerError)
    expect(error.type).toBe(WorkerErrorType.messageError)
    expect(error.message).toContain('1n')
  })

  it('leaves messages after ready to the caller', async () => {
    const worker = await createWorkerVite(
      new URL('../-test/workerMessageLate.ts', import.meta.url),
    )
    const message = await new Promise(resolve => {
      worker.on('message', resolve)
    })
    expect(message).toBe(1n)
    await worker.terminate()
  })
})

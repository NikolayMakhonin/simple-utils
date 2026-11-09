import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createWorkerVite } from './createWorkerVite'
import { WorkerError, WorkerErrorType } from '../types'

describe('createWorkerVite', { timeout: 60 * 1000 }, () => {
  // Silences console.error: createWorkerVite logs every error of the worker thread.
  // These tests cause errors on purpose
  beforeAll(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterAll(() => {
    vi.restoreAllMocks()
  })

  it('rejects when the script throws during import', async () => {
    const error: Error = await createWorkerVite(
      new URL('../-test/workerThrow.ts', import.meta.url),
    ).then(
      () => {
        throw new Error('[test] createWorkerVite must reject')
      },
      o => o,
    )
    expect(error.message).toBe('test worker error')
    // The line of the throw in workerThrow.ts.
    // Vite removes a type from that file, which moves the throw to another line.
    // So only a source map gives this line in the stack
    expect(error.stack).toContain('workerThrow.ts:6:')
  })

  it('rejects when the script posts a message during import', async () => {
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

  it('passes messages posted after import to the caller', async () => {
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

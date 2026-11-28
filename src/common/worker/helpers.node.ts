import { describe, it, expect } from 'vitest'
import { isWebWorker } from './helpers'
import { createWorkerVite } from './create/createWorkerVite'
import { WorkerClient } from './WorkerClient'
import { WorkerClientRequestType } from './types'
import {
  type WorkerFunctionRequest,
  WorkerFunctionRequestType,
  type WorkerFunctionResponse,
} from './function/types'
import { createConnectDirect } from './-test/createConnectDirect'
import { ManualPromise } from 'src/common/async/promise/ManualPromise'

describe('isWebWorker', () => {
  it('false outside browsers', () => {
    expect(isWebWorker()).toBe(false)
  })
})

describe('getWorkerFatalErrors', () => {
  it('lets Node.js end a worker thread after an error that no call catches', async () => {
    const worker = await createWorkerVite(
      new URL('./-test/worker.ts', import.meta.url),
    )
    try {
      const firstError = new ManualPromise<Error>()
      worker.on('error', error => {
        firstError.resolve(error)
      })
      const client = new WorkerClient<
        WorkerFunctionRequest<null, never>,
        WorkerFunctionResponse<null, never>
      >({ connectionName: 'fatal', connect: createConnectDirect(worker) })
      await client.connect()
      client.emit({
        type: WorkerClientRequestType.data,
        data: { data: { type: WorkerFunctionRequestType.input, data: null } },
      })
      // Node.js gives the creating thread the uncaught error of a worker thread
      // exclusively when the error ends the thread
      expect((await firstError.promise).message).toBe('[test] fatal')
    } finally {
      await worker.terminate()
    }
  })
})

import { describe, it, expect } from 'vitest'
import {
  AbortControllerFast,
  type IAbortSignalFast,
} from '@flemist/abort-controller-fast'
import { WorkerClient } from './WorkerClient'
import { WorkerServer } from './WorkerServer'
import {
  WorkerClientResponseType,
  WorkerClientStatus,
  WorkerServerRequestType,
} from './types'
import { ManualPromise } from 'src/common/async/promise/ManualPromise'

describe('WorkerClient', () => {
  /**
   * Connects a client to a WorkerServer in this thread and counts the releases
   * of the connection; the server closes the connection exclusively when
   * the test closes it
   */
  function createClient(abortSignal?: null | IAbortSignalFast) {
    let releaseCount = 0
    let server: WorkerServer<unknown, unknown> = null!
    const client = new WorkerClient<unknown, unknown>({
      connectionName: 'test',
      connect: (connectionName, messagePort) => {
        server = new WorkerServer({ messagePort })
        server.connect()
        return () => {
          releaseCount++
        }
      },
      abortSignal,
    })
    return {
      client,
      getServer: () => server,
      getReleaseCount: () => releaseCount,
    }
  }

  it('base', async () => {
    const { client, getServer, getReleaseCount } = createClient()
    await client.connect()
    expect(client.status).toBe(WorkerClientStatus.connected)
    getServer().subscribe(event => {
      if (event.type === WorkerServerRequestType.close) {
        getServer().close()
      }
    })
    const closePromise = client.close()
    expect(getReleaseCount()).toBe(1)
    await closePromise
    expect(client.status).toBe(WorkerClientStatus.closed)
    expect(getReleaseCount()).toBe(1)
  })

  it('an abort releases the worker when the worker closes the connection', async () => {
    const abortController = new AbortControllerFast()
    const { client, getServer, getReleaseCount } = createClient(
      abortController.signal,
    )
    await client.connect()
    const closeRequest = new ManualPromise()
    getServer().subscribe(event => {
      if (event.type === WorkerServerRequestType.close) {
        closeRequest.resolve()
      }
    })
    const closed = new ManualPromise()
    client.subscribe(event => {
      if (
        event.type === WorkerClientResponseType.status &&
        event.status === WorkerClientStatus.closed
      ) {
        closed.resolve()
      }
    })

    abortController.abort()
    await closeRequest.promise
    expect(getReleaseCount()).toBe(0)

    getServer().close()
    await closed.promise
    expect(getReleaseCount()).toBe(1)
  })
})

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
   * and the cancels of the connection; the server closes the connection exclusively
   * when the test closes it, and terminate plays the connector that ends the worker
   */
  function createClient(abortSignal?: null | IAbortSignalFast) {
    let releaseCount = 0
    let abortCount = 0
    let server: WorkerServer<unknown, unknown> = null!
    let onTerminateConnection: () => void = null!
    const client = new WorkerClient<unknown, unknown>({
      connectionName: 'test',
      connect: (connectionName, messagePort, onTerminate) => {
        server = new WorkerServer({ messagePort })
        server.connect()
        onTerminateConnection = onTerminate
        return {
          release() {
            releaseCount++
          },
          abort() {
            abortCount++
          },
        }
      },
      abortSignal,
    })
    return {
      client,
      getServer: () => server,
      getReleaseCount: () => releaseCount,
      getAbortCount: () => abortCount,
      terminate: () => {
        onTerminateConnection()
      },
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
    const { client, getServer, getReleaseCount, getAbortCount } = createClient(
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
    expect(getAbortCount()).toBe(1)
    expect(getReleaseCount()).toBe(0)

    getServer().close()
    await closed.promise
    expect(getReleaseCount()).toBe(1)
  })

  it('a connector that ends the worker closes the connection', async () => {
    const abortController = new AbortControllerFast()
    const { client, getReleaseCount, terminate } = createClient(
      abortController.signal,
    )
    await client.connect()
    abortController.abort()
    terminate()
    expect(client.status).toBe(WorkerClientStatus.closed)
    expect(getReleaseCount()).toBe(1)
  })

  it('a cancel right after connect reaches the connector', async () => {
    const abortController = new AbortControllerFast()
    const { client, getAbortCount } = createClient(abortController.signal)
    const connected = client.connect()
    abortController.abort()
    expect(getAbortCount()).toBe(1)
    await connected
  })
})

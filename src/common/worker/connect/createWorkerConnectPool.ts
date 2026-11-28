import type {
  IMessagePort,
  IWorker,
  WorkerConnect,
  WorkerConnectRequest,
} from '../types'
import { refuseWorkerConnection } from '../helpers'
import type { PromiseLikeOrValue } from 'src/common/types'
import { clockDateReal } from 'src/common/time/clock-date'

export type WorkerConnectPoolOptions = {
  /**
   * Creates the worker of the index: the smallest index from 0 that no other worker
   * of the pool holds, so the indexes stay below maxCount, and a worker created
   * after the pool ended another one can get the index of that one.
   * The worker must set up the message handler synchronously upon creation,
   * otherwise the first messages may be lost.
   */
  createWorker: (index: number) => PromiseLikeOrValue<IWorker>
  /** The most workers that the pool creates */
  maxCount: number
}

export type WorkerConnectPool = {
  connect: WorkerConnect
  terminate(): Promise<void>
}

/** A worker of the pool with the connections that it holds open */
type PoolWorker = {
  /** The index that createWorker got for this worker */
  readonly index: number
  readonly worker: PromiseLikeOrValue<IWorker>
  connections: Set<PoolConnection>
  /** The count of the connections whose operation is cancelled */
  abortedCount: number
}

/** A connection that a worker of the pool holds open */
type PoolConnection = {
  /** Tells the connection that the pool ended its worker, with the error that ended it */
  readonly onTerminate: (error?: unknown) => void
  isAborted: boolean
}

/**
 * Connects to up to maxCount workers, so that connections that follow one
 * another go to one worker, and connections open at the same time go to
 * different workers. A connection goes to a worker without unreleased
 * connections; a worker is created exclusively when every worker has one,
 * and with maxCount such workers the connection goes to the one with
 * the fewest. A worker busy with a synchronous task queues the connections
 * that reach it until the task ends. A worker whose open connections are all
 * cancelled is ended at once, which stops their operations and frees its memory,
 * and the next connections go to the other workers or to a new one.
 * A worker that reports an error is ended at once too, so that its connections end
 * with its error instead of waiting for a worker that is dead or broken.
 * The connections of a worker that fails to start end with the error of its start,
 * and the next connection starts another worker
 */
export function createWorkerConnectPool(
  options: WorkerConnectPoolOptions,
): WorkerConnectPool {
  const workers: PoolWorker[] = []

  function getWorker(): PoolWorker {
    for (let i = 0, len = workers.length; i < len; i++) {
      if (workers[i].connections.size === 0) {
        return workers[i]
      }
    }
    if (workers.length < options.maxCount) {
      // The workers stay sorted by index, so the first position whose worker
      // has another index is the index that an ended worker left free
      let index = 0
      while (index < workers.length && workers[index].index === index) {
        index++
      }
      const poolWorker: PoolWorker = {
        index,
        worker: options.createWorker(index),
        connections: new Set(),
        abortedCount: 0,
      }
      workers.splice(index, 0, poolWorker)
      Promise.resolve(poolWorker.worker).then(
        worker => {
          // An error of a worker is a failure that must never happen.
          // After it the worker is dead, as after a failed load of its script,
          // or in a state that nothing can trust.
          // So the pool ends it at once, and its calls fail with its error
          // instead of waiting for it
          function onError(error: Error) {
            worker.off('error', onError)
            removeWorker(poolWorker)
            void terminateWorker(poolWorker, error)
          }
          worker.on('error', onError)
        },
        () => {
          // A worker that failed to start serves no connection, so it leaves the pool,
          // and the next connection starts another one.
          // Its connections get the error from sendConnectRequest
          removeWorker(poolWorker)
        },
      )
      return poolWorker
    }
    let leastBusy = workers[0]
    for (let i = 1, len = workers.length; i < len; i++) {
      if (workers[i].connections.size < leastBusy.connections.size) {
        leastBusy = workers[i]
      }
    }
    return leastBusy
  }

  /**
   * Ends the worker once every connection that it holds is cancelled,
   * so that operations that do not stop at the cancel, such as synchronous ones,
   * stop with the worker
   */
  function terminateIfAllAborted(poolWorker: PoolWorker): void {
    const count = poolWorker.connections.size
    if (count === 0 || poolWorker.abortedCount < count) {
      return
    }
    removeWorker(poolWorker)
    void terminateWorker(poolWorker)
  }

  /**
   * Takes the worker out of the pool, so that no new connection goes to it.
   * Does nothing for a worker that has left the pool already, because one
   * that failed to start can still be ended by the pool, and one that the pool
   * ended can still fail to start
   */
  function removeWorker(poolWorker: PoolWorker): void {
    const index = workers.indexOf(poolWorker)
    if (index >= 0) {
      workers.splice(index, 1)
    }
  }

  return {
    connect(
      connectionName: string,
      messagePort: IMessagePort,
      onTerminate: (error?: unknown) => void,
    ) {
      const poolWorker = getWorker()
      const connection: PoolConnection = { onTerminate, isAborted: false }
      poolWorker.connections.add(connection)
      void sendConnectRequest(poolWorker.worker, connectionName, messagePort)
      return {
        release() {
          // The pool has already ended the worker and told the connection
          if (!poolWorker.connections.delete(connection)) {
            return
          }
          // A release ends no worker: the cancelled connections that remain
          // wait behind it and never start, or run asynchronously and see the cancel
          if (connection.isAborted) {
            poolWorker.abortedCount--
          }
        },
        abort() {
          connection.isAborted = true
          poolWorker.abortedCount++
          terminateIfAllAborted(poolWorker)
        },
      }
    },

    async terminate() {
      const promise = Promise.all(
        workers.map(poolWorker => terminateWorker(poolWorker)),
      )
      workers.length = 0
      await promise
    },
  }
}

/**
 * Sends the worker, once it is created, the request to open a connection through the port,
 * or refuses the connection with the error that stopped the creation of the worker
 */
async function sendConnectRequest(
  workerPromise: PromiseLikeOrValue<IWorker>,
  connectionName: string,
  messagePort: IMessagePort,
): Promise<void> {
  let worker: IWorker
  try {
    worker = await workerPromise
  } catch (error) {
    refuseWorkerConnection(messagePort, error)
    return
  }
  const request: WorkerConnectRequest = {
    type: 'connect',
    connectionName,
    messagePort,
    clockDateRealOffset: clockDateReal.offset,
    clockDateRealDateMinimum: clockDateReal.dateMinimum,
  }
  worker.postMessage(request, [messagePort])
}

/**
 * Ends the worker, then tells each of its connections that the worker ended,
 * because the worker can no longer close them.
 * Each connection gets the error that ended the worker, when there is one.
 * The connections learn of it after the call that ended the worker returns,
 * because a client can cancel inside the handling of an event of its connection.
 * The connections leave the worker first, so that their releases find nothing to count
 */
async function terminateWorker(
  poolWorker: PoolWorker,
  error?: unknown,
): Promise<void> {
  const connections = poolWorker.connections
  poolWorker.connections = new Set()
  try {
    let worker: IWorker
    try {
      worker = await poolWorker.worker
    } catch {
      // A worker that failed to start runs nothing to end
      return
    }
    await worker.terminate()
  } finally {
    connections.forEach(connection => {
      connection.onTerminate(error)
    })
  }
}

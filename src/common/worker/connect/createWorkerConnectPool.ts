import type {
  IMessagePort,
  IWorker,
  WorkerConnect,
  WorkerConnectRequest,
} from '../types'
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
  /** Tells the connection that the pool ended its worker */
  readonly onTerminate: () => void
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
 * and the next connections go to the other workers or to a new one
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
    workers.splice(workers.indexOf(poolWorker), 1)
    void terminateWorker(poolWorker)
  }

  return {
    connect(
      connectionName: string,
      messagePort: IMessagePort,
      onTerminate: () => void,
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
      const promise = Promise.all(workers.map(terminateWorker))
      workers.length = 0
      await promise
    },
  }
}

/** Sends the worker, once it is created, the request to open a connection through the port */
async function sendConnectRequest(
  workerPromise: PromiseLikeOrValue<IWorker>,
  connectionName: string,
  messagePort: IMessagePort,
): Promise<void> {
  const worker = await workerPromise
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
 * Ends the worker, then tells each of its connections, which the worker can no longer close.
 * The connections learn of it after the call that ended the worker returns,
 * because a client can cancel inside the handling of an event of its connection.
 * The connections leave the worker first, so that their releases find nothing to count
 */
async function terminateWorker(poolWorker: PoolWorker): Promise<void> {
  const connections = poolWorker.connections
  poolWorker.connections = new Set()
  try {
    const worker = await poolWorker.worker
    await worker.terminate()
  } finally {
    connections.forEach(connection => {
      connection.onTerminate()
    })
  }
}

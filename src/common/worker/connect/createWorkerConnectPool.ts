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

/** A worker of the pool with the count of the connections that it holds open */
type PoolWorker = {
  readonly worker: PromiseLikeOrValue<IWorker>
  connectionsCount: number
}

/**
 * Connects to up to maxCount workers, so that connections that follow one
 * another go to one worker, and connections open at the same time go to
 * different workers. A connection goes to a worker without unreleased
 * connections; a worker is created exclusively when every worker has one,
 * and with maxCount such workers the connection goes to the one with
 * the fewest. A worker busy with a synchronous task queues the connections
 * that reach it until the task ends
 */
export function createWorkerConnectPool(
  options: WorkerConnectPoolOptions,
): WorkerConnectPool {
  const workers: PoolWorker[] = []

  function getWorker(): PoolWorker {
    for (let i = 0, len = workers.length; i < len; i++) {
      if (workers[i].connectionsCount === 0) {
        return workers[i]
      }
    }
    if (workers.length < options.maxCount) {
      const poolWorker: PoolWorker = {
        worker: options.createWorker(workers.length),
        connectionsCount: 0,
      }
      workers.push(poolWorker)
      return poolWorker
    }
    let leastBusy = workers[0]
    for (let i = 1, len = workers.length; i < len; i++) {
      if (workers[i].connectionsCount < leastBusy.connectionsCount) {
        leastBusy = workers[i]
      }
    }
    return leastBusy
  }

  return {
    connect(connectionName: string, messagePort: IMessagePort) {
      const poolWorker = getWorker()
      poolWorker.connectionsCount++
      void sendConnectRequest(poolWorker.worker, connectionName, messagePort)
      return () => {
        poolWorker.connectionsCount--
      }
    },

    async terminate() {
      const promise = Promise.all(
        workers.map(async poolWorker => {
          const worker = await poolWorker.worker
          await worker.terminate()
        }),
      )
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

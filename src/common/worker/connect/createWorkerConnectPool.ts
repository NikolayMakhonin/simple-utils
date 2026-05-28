import type {
  IMessagePort,
  IWorker,
  WorkerConnect,
  WorkerConnectRequest,
} from '../types'
import type { PromiseLikeOrValue } from 'src/common/types'

export type WorkerConnectPoolOptions = {
  /**
   * The worker must set up the message handler synchronously upon creation,
   * otherwise the first messages may be lost.
   */
  createWorker: (index: number) => PromiseLikeOrValue<IWorker>
  maxCount: number
}

export type WorkerConnectPool = {
  connect: WorkerConnect
  terminate(): Promise<void>
}

/**
 * Evenly distributes connections between multiple workers,
 * creating them as needed but no more than maxCount.
 * The number of connections per worker is not limited;
 * if a worker is busy with a synchronous task,
 * the connection request will be queued.
 */
export function createWorkerConnectPool(
  options: WorkerConnectPoolOptions,
): WorkerConnectPool {
  const pool: PromiseLikeOrValue<IWorker>[] = []
  let prevWorkerIndex = -1

  function getWorker(): PromiseLikeOrValue<IWorker> {
    prevWorkerIndex = (prevWorkerIndex + 1) % options.maxCount
    if (prevWorkerIndex >= pool.length) {
      const worker = options.createWorker(prevWorkerIndex)
      pool.push(worker)
    }
    return pool[prevWorkerIndex]
  }

  return {
    async connect(connectionName: string, messagePort: IMessagePort) {
      const worker = await getWorker()
      worker.postMessage(
        {
          type: 'connect',
          connectionName,
          messagePort,
        } as WorkerConnectRequest,
        [messagePort],
      )
    },

    async terminate() {
      const workers = await Promise.all(pool)
      for (let i = 0, len = workers.length; i < len; i++) {
        workers[i].terminate()
      }
      pool.length = 0
    },
  }
}

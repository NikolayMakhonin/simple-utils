import type {
  IMessagePort,
  WorkerConnect,
  WorkerConnectRequest,
} from '../types'
import type { PromiseLikeOrValue } from 'src/common/types'

export type WorkerConnectPoolOptions = {
  /**
   * The worker must set up the message handler synchronously upon creation,
   * otherwise the first messages may be lost.
   */
  createWorker: (index: number) => PromiseLikeOrValue<Worker>
  maxCount: number
}

/**
 * Evenly distributes connections between multiple workers,
 * creating them as needed but no more than maxCount.
 * The number of connections per worker is not limited;
 * if a worker is busy with a synchronous task,
 * the connection request will be queued.
 * Workers are not destroyed after creation and live forever
 */
export function createWorkerConnectPool(
  options: WorkerConnectPoolOptions,
): WorkerConnect {
  const pool: PromiseLikeOrValue<Worker>[] = []
  let prevWorkerIndex = -1

  function getWorker(): PromiseLikeOrValue<Worker> {
    prevWorkerIndex = (prevWorkerIndex + 1) % options.maxCount
    if (prevWorkerIndex >= pool.length) {
      const worker = options.createWorker(prevWorkerIndex)
      pool.push(worker)
    }
    return pool[prevWorkerIndex]
  }

  return async function workerConnect(
    connectionName: string,
    messagePort: IMessagePort,
  ) {
    const worker = await getWorker()
    worker.postMessage(
      {
        type: 'connect',
        connectionName,
        messagePort,
      } as WorkerConnectRequest,
      [messagePort],
    )
  }
}

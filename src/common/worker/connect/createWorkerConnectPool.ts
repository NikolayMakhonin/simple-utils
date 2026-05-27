import type { IMessagePort, WorkerConnect } from '../types'

export type WorkerConnectPoolOptions = {
  /**
   * The worker must set up the message handler synchronously upon creation,
   * otherwise the first messages may be lost.
   */
  createWorker: (index: number) => Worker
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
  const pool: Worker[] = []
  let prevWorkerIndex = -1

  function getWorker(): Worker {
    prevWorkerIndex = (prevWorkerIndex + 1) % options.maxCount
    if (prevWorkerIndex >= pool.length) {
      const worker = options.createWorker(prevWorkerIndex)
      pool.push(worker)
    }
    return pool[prevWorkerIndex]
  }

  return function workerConnect(
    connectionName: string,
    messagePort: IMessagePort,
  ) {
    const worker = getWorker()
    worker.postMessage(
      {
        type: 'connect',
        name: connectionName,
        port: messagePort,
      },
      [messagePort],
    )
  }
}

import type { IWorker, WorkerConnect, WorkerConnectRequest } from '../types'

/**
 * Connects to the worker directly, without the pool, which ends a worker at its error,
 * so that exclusively the worker ends its connections
 */
export function createConnectDirect(worker: IWorker): WorkerConnect {
  return (connectionName, messagePort) => {
    const request: WorkerConnectRequest = {
      type: 'connect',
      connectionName,
      messagePort,
      clockDateRealOffset: null,
      clockDateRealDateMinimum: null,
    }
    worker.postMessage(request, [messagePort])
    return {
      release() {},
      abort() {},
    }
  }
}

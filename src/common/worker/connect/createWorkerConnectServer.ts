import type { IMessagePort, WorkerConnectRequest } from '../types'
import { isWebWorker, serializeError } from '../helpers'

export type CreateWorkerConnectServerOptions = {
  handlers: Record<string, (messagePort: IMessagePort) => void>
}

export function createWorkerConnectServer(
  options: CreateWorkerConnectServerOptions,
) {
  function onMessage(data: WorkerConnectRequest) {
    const { type, connectionName, messagePort } = data
    if (type === 'connect') {
      const handler = options.handlers[connectionName]
      if (!handler) {
        messagePort.postMessage({
          type: 'error',
          error: serializeError(
            new Error(
              `[createWorkerConnectServer] no handler for connectionName ${connectionName}`,
            ),
          ),
        })
        return
      }
      handler(messagePort)
    }
  }

  if (isWebWorker()) {
    self.addEventListener('message', (event: MessageEvent) => {
      onMessage(event.data)
    })
  } else {
    import('worker_threads').then(({ isMainThread, parentPort }) => {
      if (isMainThread) {
        return
      }
      parentPort!.on('message', onMessage)
    })
  }
}

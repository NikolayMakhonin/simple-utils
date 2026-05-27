import type {
  IMessagePort,
  WorkerConnectRequest,
  WorkerServerHandler,
} from './types'
import { isWebWorker, serializeError } from './helpers'

const workerServerHandlers: Record<string, WorkerServerHandler> = {}

export type WorkerServerRegisterOptions = Record<
  string,
  (messagePort: IMessagePort) => void
>

export function workerServerRegister(handlers: WorkerServerRegisterOptions) {
  for (const connectionName in handlers) {
    if (Object.prototype.hasOwnProperty.call(handlers, connectionName)) {
      if (connectionName in workerServerHandlers) {
        throw new Error(
          `[workerServerRegister] handler for connectionName ${connectionName} already exists`,
        )
      }
      workerServerHandlers[connectionName] = handlers[connectionName]
    }
  }
}

function sendError(messagePort: IMessagePort, error: Error) {
  messagePort.postMessage({
    type: 'error',
    error: serializeError(error),
  })
}

export function workerServerStart() {
  function onMessage(data: WorkerConnectRequest) {
    const { type, connectionName, messagePort } = data
    if (type === 'connect') {
      const handler = workerServerHandlers[connectionName]
      if (!handler) {
        sendError(
          messagePort,
          new Error(
            `[createWorkerConnectServer] no handler for connectionName ${connectionName}`,
          ),
        )
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

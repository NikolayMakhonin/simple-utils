import type {
  IMessagePort,
  WorkerConnectRequest,
  WorkerServerHandler,
} from './types'
import { serializeError } from './helpers'
import { timeControllerDefault } from 'src/common/time/time-controller'

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
    const {
      type,
      connectionName,
      messagePort,
      timeControllerOffset,
      timeControllerOffsetDate,
    } = data
    if (type === 'connect') {
      timeControllerDefault.offset = timeControllerOffset
      timeControllerDefault.offsetDate = timeControllerOffsetDate
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

  // Checks self instead of isWebWorker(), because a page also has self.
  // A page receives messages through the message event of self, as a web worker does
  if (typeof self !== 'undefined') {
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

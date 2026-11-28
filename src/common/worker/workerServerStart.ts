import type {
  IMessagePort,
  WorkerConnectRequest,
  WorkerServerHandler,
} from './types'
import { refuseWorkerConnection } from './helpers'
import { clockDateReal } from 'src/common/time/clock-date'

const workerServerHandlers = new Map<string, WorkerServerHandler>()

export type WorkerServerRegisterOptions = Record<
  string,
  (messagePort: IMessagePort) => void
>

export function workerServerRegister(handlers: WorkerServerRegisterOptions) {
  for (const connectionName in handlers) {
    if (Object.prototype.hasOwnProperty.call(handlers, connectionName)) {
      if (workerServerHandlers.has(connectionName)) {
        throw new Error(
          `[workerServerRegister] handler for connectionName ${connectionName} already exists`,
        )
      }
      workerServerHandlers.set(connectionName, handlers[connectionName])
    }
  }
}

export function workerServerStart() {
  function onMessage(data: WorkerConnectRequest) {
    const {
      type,
      connectionName,
      messagePort,
      clockDateRealOffset,
      clockDateRealDateMinimum,
    } = data
    if (type === 'connect') {
      if (clockDateRealOffset != null) {
        clockDateReal.updateOffset(
          clockDateRealOffset,
          clockDateRealDateMinimum,
        )
      }
      const handler = workerServerHandlers.get(connectionName)
      if (!handler) {
        refuseWorkerConnection(
          messagePort,
          new Error(
            `[workerServerStart] no handler for connectionName ${connectionName}`,
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

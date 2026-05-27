import { createWorkerFunctionServer } from '../function/createWorkerFunctionServer'
import type { IMessagePort, WorkerConnectRequest } from '../types'
import type { WorkerFunctionTestInput, WorkerFunctionTestOutput } from './types'
import { serializeError } from '../helpers'
import { isWebWorker } from '../helpers'

const sum = createWorkerFunctionServer<
  WorkerFunctionTestInput,
  WorkerFunctionTestOutput
>({
  func({ data }) {
    return Promise.resolve({
      data: { result: data.data.a + data.data.b },
    })
  },
})

const handlers: Record<string, (messagePort: IMessagePort) => void> = {
  sum,
}

function onMessage(data: WorkerConnectRequest) {
  const { type, connectionName, messagePort } = data
  if (type === 'connect') {
    const handler = handlers[connectionName]
    if (!handler) {
      messagePort.postMessage({
        type: 'error',
        error: serializeError(
          new Error(`[Worker] no handler for connectionName ${connectionName}`),
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

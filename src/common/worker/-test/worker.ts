import { createWorkerFunctionServer } from '../function/createWorkerFunctionServer'
import type { IMessagePort, WorkerConnectRequest } from '../types'
import type { WorkerFunctionTestInput, WorkerFunctionTestOutput } from './types'
import { serializeError } from '../helpers'

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

self.addEventListener('message', (event: MessageEvent) => {
  const { type, connectionName, messagePort } =
    event.data as WorkerConnectRequest
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
})

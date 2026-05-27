import { createWorkerFunctionServer } from '../function/createWorkerFunctionServer'
import type { WorkerFunctionTestInput, WorkerFunctionTestOutput } from './types'
import { createWorkerConnectServer } from '../connect/createWorkerConnectServer'

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

createWorkerConnectServer({
  handlers: {
    sum,
  },
})

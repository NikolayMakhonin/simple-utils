import { createWorkerFunctionServer } from '../function/createWorkerFunctionServer'
import type {
  WorkerFunctionTestCallback,
  WorkerFunctionTestInput,
  WorkerFunctionTestOutput,
} from './types'
import { createWorkerConnectServer } from '../connect/createWorkerConnectServer'
import { delay } from 'src/common/async/wait/delay'

const sum = createWorkerFunctionServer<
  WorkerFunctionTestInput,
  WorkerFunctionTestOutput,
  WorkerFunctionTestCallback
>({
  async func({ data, callback, abortSignal }) {
    const { a, b, steps, stepDurationMs } = data.data
    let completedSteps = 0

    for (let i = 0; i < steps; i++) {
      await delay(stepDurationMs, abortSignal)
      completedSteps++
      callback?.({
        data: { progress: completedSteps / steps },
      })
    }

    return {
      data: {
        result: a + b,
        completedSteps,
      },
    }
  },
})

createWorkerConnectServer({
  handlers: {
    sum,
  },
})

import { createWorkerFunctionServer } from '../function/createWorkerFunctionServer'
import type {
  WorkerFunctionTestCallback,
  WorkerFunctionTestInput,
  WorkerFunctionTestOutput,
} from './types'
import { createWorkerConnectServer } from '../connect/createWorkerConnectServer'
import { delay } from 'src/common/async/wait/delay'

const workerId = Math.random().toString(36).substring(2)

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
        data: { progress: completedSteps / steps, workerId },
      })
    }

    return {
      data: {
        result: a + b,
        completedSteps,
        workerId,
      },
    }
  },
})

createWorkerConnectServer({
  handlers: {
    sum,
  },
})

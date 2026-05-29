import { createWorkerFunctionServer } from '../function/createWorkerFunctionServer'
import { workerRequestHandler } from '../function/workerRequestHandler'
import { workerRequest } from '../function/workerRequest'
import type {
  WorkerFunctionTestEvent,
  WorkerFunctionTestInput,
  WorkerFunctionTestMultiplyRequest,
  WorkerFunctionTestMultiplyResponse,
  WorkerFunctionTestOutput,
} from './types'
import { workerServerRegister, workerServerStart } from '../workerServerStart'
import { delay } from 'src/common/async/wait/delay'

const workerId = Math.random().toString(36).substring(2)

const sum = createWorkerFunctionServer<
  WorkerFunctionTestInput,
  WorkerFunctionTestOutput,
  WorkerFunctionTestEvent,
  WorkerFunctionTestEvent
>({
  async func({ data, eventBus, abortSignal }) {
    const { a, b, steps, stepDurationMs } = data.data
    let completedSteps = 0

    workerRequestHandler<
      WorkerFunctionTestMultiplyRequest,
      WorkerFunctionTestMultiplyResponse
    >(eventBus, requestData => ({
      data: {
        product: requestData.data.x * requestData.data.y,
        workerId,
      },
    }))

    for (let i = 0; i < steps; i++) {
      await delay(stepDurationMs, abortSignal)
      completedSteps++
      eventBus.emit({
        type: 'event',
        data: { data: { progress: completedSteps / steps, workerId } },
      })
    }

    const multiplyResult = await workerRequest<
      WorkerFunctionTestMultiplyRequest,
      WorkerFunctionTestMultiplyResponse
    >(eventBus, { data: { x: a, y: b } }, { abortSignal })

    return {
      data: {
        result: a + b,
        completedSteps,
        workerId,
        product: multiplyResult.data.product,
      },
    }
  },
})

workerServerRegister({
  sum,
})

workerServerStart()

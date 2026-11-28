import { createWorkerFunctionServer } from '../function/createWorkerFunctionServer'
import { workerRequestHandler } from '../request/workerRequestHandler'
import { workerRequest } from '../request/workerRequest'
import type {
  WorkerFunctionTestBusyEvent,
  WorkerFunctionTestBusyInput,
  WorkerFunctionTestBusyOutput,
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
    const { a, b, steps, stepTime } = data.data
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
      await delay(stepTime, abortSignal)
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

let busyStartCount = 0

/**
 * Holds the worker synchronously for the given time, as a long computation does,
 * so that the messages that reach the worker meanwhile wait until it returns
 */
const busy = createWorkerFunctionServer<
  WorkerFunctionTestBusyInput,
  WorkerFunctionTestBusyOutput,
  never,
  WorkerFunctionTestBusyEvent
>({
  func({ data, eventBus }) {
    busyStartCount++
    eventBus.emit({ type: 'event', data: { data: null } })
    const timeEnd = performance.now() + data.data.holdTime
    while (performance.now() < timeEnd) {
      // Returns to the event loop exclusively at the end
    }
    return {
      data: { workerId, startCount: busyStartCount },
    }
  },
})

workerServerRegister({
  sum,
  busy,
})

workerServerStart()

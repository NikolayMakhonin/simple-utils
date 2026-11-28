import { afterAll, describe, expect, it } from 'vitest'
import {
  AbortControllerFast,
  AbortError,
  type IAbortSignalFast,
} from '@flemist/abort-controller-fast'
import { createWorkerFunctionClient } from './function/createWorkerFunctionClient'
import { workerRequest } from './request/workerRequest'
import { workerRequestHandler } from './request/workerRequestHandler'
import { createWorkerConnectPool } from './connect/createWorkerConnectPool'
import type {
  WorkerFunctionTestBusyEvent,
  WorkerFunctionTestBusyInput,
  WorkerFunctionTestBusyOutput,
  WorkerFunctionTestEvent,
  WorkerFunctionTestInput,
  WorkerFunctionTestMultiplyRequest,
  WorkerFunctionTestMultiplyResponse,
  WorkerFunctionTestOutput,
} from './-test/types'
import { createWorkerVite } from './create/createWorkerVite'
import { createWorkerWeb } from './create/createWorkerWeb'
import { ManualPromise } from 'src/common/async/promise/ManualPromise'
import { AbortSignalMock } from 'src/common/async/abort/-test/AbortSignalMock'
import {
  WorkerClientRequestType,
  WorkerClientResponseType,
  WorkerClientStatus,
  type WorkerConnect,
  type WorkerError,
  WorkerErrorType,
} from './types'
import { WorkerClient } from './WorkerClient'
import { createConnectDirect } from './-test/createConnectDirect'
import {
  type WorkerFunctionRequest,
  WorkerFunctionRequestType,
  type WorkerFunctionResponse,
} from './function/types'

const STEP_TIME = 100
const TOTAL_STEPS = 10
const WORKER_COUNT = 3
const TASKS_PER_WORKER = 3
// Long enough for a test to call the worker again while busy holds it
const BUSY_HOLD_TIME = 1000

const pool = createWorkerConnectPool({
  createWorker: createTestWorker,
  maxCount: WORKER_COUNT,
})

function createTestWorker() {
  return createWorkerOfScript(new URL('./-test/worker.ts', import.meta.url))
}

function createWorkerOfScript(url: URL) {
  // Node.js has no Worker, so there the worker runs through Vite in a worker thread.
  // In browsers it runs as a web worker
  return typeof Worker === 'undefined'
    ? createWorkerVite(url)
    : createWorkerWeb(url)
}

/** Calls busy, the function of the test worker that holds its worker synchronously */
function createBusy(connect: WorkerConnect) {
  return createWorkerFunctionClient<
    WorkerFunctionTestBusyInput,
    WorkerFunctionTestBusyOutput,
    never,
    WorkerFunctionTestBusyEvent
  >({ connect, connectionName: 'busy' })
}

/** Starts a call of busy and waits until the call holds the worker */
async function startBusy(
  busy: WorkerFunctionTestBusyClient,
  holdTime: number,
  abortSignal?: null | IAbortSignalFast,
) {
  const call = busy({ data: { data: { holdTime } }, abortSignal })
  const started = new ManualPromise()
  call.subscribe(() => {
    started.resolve()
  })
  await call.start()
  await started.promise
  return call
}

type WorkerFunctionTestBusyClient = ReturnType<typeof createBusy>

/**
 * Sends the inputs to the worker function of connectionName in a new test worker
 * through createConnectDirect, and gives the errors that the client got
 * until the connection closed
 */
async function sendInputsDirect(connectionName: string, inputs: unknown[]) {
  const worker = await createTestWorker()
  try {
    const client = new WorkerClient<
      WorkerFunctionRequest<unknown, never>,
      WorkerFunctionResponse<unknown, never>
    >({ connectionName, connect: createConnectDirect(worker) })
    const errors: unknown[] = []
    const closed = new ManualPromise()
    client.subscribe(event => {
      if (event.type === WorkerClientResponseType.error) {
        errors.push(event.error)
      } else if (
        event.type === WorkerClientResponseType.status &&
        event.status === WorkerClientStatus.closed
      ) {
        closed.resolve()
      }
    })
    await client.connect()
    for (let i = 0; i < inputs.length; i++) {
      client.emit({
        type: WorkerClientRequestType.data,
        data: {
          data: { type: WorkerFunctionRequestType.input, data: inputs[i] },
        },
      })
    }
    await closed.promise
    return errors
  } finally {
    await worker.terminate()
  }
}

afterAll(async () => {
  await pool.terminate()
})

const sum = createWorkerFunctionClient<
  WorkerFunctionTestInput,
  WorkerFunctionTestOutput,
  WorkerFunctionTestEvent,
  WorkerFunctionTestEvent
>({
  connect: pool.connect,
  connectionName: 'sum',
})

async function test(a: number, b: number, useAbort: boolean): Promise<string> {
  const abortController = useAbort ? new AbortControllerFast() : null
  const progressValues: number[] = []
  let workerId: string | null = null

  const call = sum({
    data: {
      data: { a, b, steps: TOTAL_STEPS, stepTime: STEP_TIME },
    },
    abortSignal: abortController?.signal,
  })

  call.subscribe(event => {
    if (event.type === 'event') {
      workerId = event.data.data.workerId
      progressValues.push(event.data.data.progress)
      if (useAbort && event.data.data.progress >= 0.5) {
        abortController!.abort()
      }
    }
  })

  workerRequestHandler<
    WorkerFunctionTestMultiplyRequest,
    WorkerFunctionTestMultiplyResponse
  >(call, requestData => ({
    data: {
      product: requestData.data.x * requestData.data.y * 10,
      workerId: 'client',
    },
  }))

  await call.start()

  if (useAbort) {
    await expect(call.end()).rejects.toThrow(AbortError)
    expect(progressValues.length).toBeGreaterThanOrEqual(TOTAL_STEPS / 2)
    expect(progressValues.length).toBeLessThan(TOTAL_STEPS)
    expect(progressValues[progressValues.length - 1]).toBeGreaterThanOrEqual(
      0.5,
    )
    expect(progressValues[progressValues.length - 1]).toBeLessThan(1)
  } else {
    const serverMultiply = await workerRequest<
      WorkerFunctionTestMultiplyRequest,
      WorkerFunctionTestMultiplyResponse
    >(call, { data: { x: a + 1, y: b + 1 } })
    expect(serverMultiply.data.product).toBe((a + 1) * (b + 1))

    const result = await call.end()
    expect(result.data.result).toBe(a + b)
    expect(result.data.workerId).toBe(workerId)
    expect(result.data.completedSteps).toBe(TOTAL_STEPS)
    expect(result.data.product).toBe(a * b * 10)
    expect(progressValues.length).toBe(TOTAL_STEPS)
    expect(progressValues[0]).toBe(1 / TOTAL_STEPS)
    expect(progressValues[progressValues.length - 1]).toBe(1)
    for (let i = 1; i < progressValues.length; i++) {
      expect(progressValues[i]).toBeGreaterThan(progressValues[i - 1])
    }
  }

  expect(workerId).not.toBe(null)
  return workerId!
}

async function testParallel(useAbort: boolean) {
  const taskCount = WORKER_COUNT * TASKS_PER_WORKER
  const promises: Promise<string>[] = []
  for (let i = 0; i < taskCount; i++) {
    promises.push(test(i, i + 1, useAbort))
  }
  const workerIds = await Promise.all(promises)

  const taskCounts = new Map<string, number>()
  for (let i = 0; i < workerIds.length; i++) {
    const id = workerIds[i]
    taskCounts.set(id, (taskCounts.get(id) ?? 0) + 1)
  }

  expect(taskCounts.size).toBe(WORKER_COUNT)
  for (const [, count] of taskCounts) {
    expect(count).toBe(TASKS_PER_WORKER)
  }
}

describe('workerFunction', { timeout: 60 * 1000 }, () => {
  it('base', async () => {
    await testParallel(false)
  })

  it('abort', async () => {
    await testParallel(true)
  })

  it('calls that follow one another run in one worker', async () => {
    const workerId = await test(1, 2, false)
    expect(await test(3, 4, false)).toBe(workerId)
  })

  it('a call of a name that the worker lacks ends with the error of the worker', async () => {
    const missing = createWorkerFunctionClient<null, null>({
      connect: pool.connect,
      connectionName: 'missing',
    })
    await expect(missing({ data: { data: null } }).end()).rejects.toThrow(
      'no handler for connectionName missing',
    )
  })

  it('a call ends with the error of a worker that fails to start', async () => {
    const poolFailing = createWorkerConnectPool({
      createWorker: async () => {
        throw new Error('[test] start failed')
      },
      maxCount: 1,
    })
    try {
      const busy = createBusy(poolFailing.connect)
      await expect(
        busy({ data: { data: { holdTime: 0 } } }).end(),
      ).rejects.toThrow('[test] start failed')
    } finally {
      await poolFailing.terminate()
    }
  })

  it('a call to a worker whose script fails to load ends with an error', async () => {
    const poolMissing = createWorkerConnectPool({
      createWorker: () =>
        createWorkerOfScript(new URL('./-test/missing.ts', import.meta.url)),
      maxCount: 1,
    })
    try {
      const busy = createBusy(poolMissing.connect)
      // In browsers the pool ends the worker at its error event and gives the call that error.
      // In Node.js createWorkerVite rejects, and the call gets its error
      await expect(
        busy({ data: { data: { holdTime: 0 } } }).end(),
      ).rejects.toThrow(
        typeof Worker === 'undefined'
          ? 'missing.ts'
          : 'error event without a message',
      )
    } finally {
      await poolMissing.terminate()
    }
  })

  it('a call to a worker that fails while it runs ends with the error of the worker', async () => {
    const poolSingle = createWorkerConnectPool({
      createWorker: createTestWorker,
      maxCount: 1,
    })
    try {
      const fatal = createWorkerFunctionClient<null, null>({
        connect: poolSingle.connect,
        connectionName: 'fatal',
      })
      // Whichever reaches the call first, the message of the worker or the error event
      // at which the pool ends the worker, it holds the error of the worker
      await expect(fatal({ data: { data: null } }).end()).rejects.toThrow(
        '[test] fatal',
      )
    } finally {
      await poolSingle.terminate()
    }
  })

  it('a call through a connector that throws ends with its error and leaves no subscription', async () => {
    const abortSignal = new AbortSignalMock()
    const busy = createBusy(() => {
      throw new Error('[test] connect failed')
    })
    await expect(
      busy({ data: { data: { holdTime: 0 } }, abortSignal }).end(),
    ).rejects.toThrow('[test] connect failed')
    expect(abortSignal.subscriptionCount).toBe(0)
  })

  it('a fatal error of the worker reaches the client once, with the place where it was thrown', async () => {
    const errors = await sendInputsDirect('fatal', [null])
    expect(errors.length).toBe(1)
    expect((errors[0] as WorkerError).type).toBe(WorkerErrorType.fatalError)
    // The client also learns where in the script of the worker the error was thrown
    expect((errors[0] as WorkerError).message).toContain('worker.ts:')
  })

  it('a second input of a call ends its connection with an error', async () => {
    const input: WorkerFunctionTestInput = {
      a: 1,
      b: 2,
      steps: TOTAL_STEPS,
      stepTime: STEP_TIME,
    }
    const errors = await sendInputsDirect('sum', [input, input])
    expect(errors.length).toBe(1)
    expect((errors[0] as Error).message).toBe(
      '[createWorkerFunctionServer] already running',
    )
  })

  it('a call cancelled while it waits for a busy worker ends at once and never starts there', async () => {
    const poolSingle = createWorkerConnectPool({
      createWorker: createTestWorker,
      maxCount: 1,
    })
    try {
      const busy = createBusy(poolSingle.connect)
      const callRunning = await startBusy(busy, BUSY_HOLD_TIME)
      let isRunningEnded = false
      const runningEnd = callRunning.end().then(result => {
        isRunningEnded = true
        return result
      })

      const abortController = new AbortControllerFast()
      const cancelledEnd = busy({
        data: { data: { holdTime: 0 } },
        abortSignal: abortController.signal,
      }).end()
      abortController.abort()
      await expect(cancelledEnd).rejects.toThrow(AbortError)
      expect(isRunningEnded).toBe(false)

      const runningResult = await runningEnd
      const nextResult = await busy({ data: { data: { holdTime: 0 } } }).end()
      expect(nextResult.data.workerId).toBe(runningResult.data.workerId)
      expect(nextResult.data.startCount).toBe(runningResult.data.startCount + 1)
    } finally {
      await poolSingle.terminate()
    }
  })

  it('a cancelled call ends its worker when the worker holds no other call', async () => {
    const poolSingle = createWorkerConnectPool({
      createWorker: createTestWorker,
      maxCount: 1,
    })
    try {
      const busy = createBusy(poolSingle.connect)
      const abortController = new AbortControllerFast()
      const callCancelled = await startBusy(
        busy,
        BUSY_HOLD_TIME,
        abortController.signal,
      )
      abortController.abort()
      // busy ignores the cancel, so exclusively the end of its worker stops it before its output
      await expect(callCancelled.end()).rejects.toThrow(AbortError)
      const nextResult = await busy({ data: { data: { holdTime: 0 } } }).end()
      expect(nextResult.data.startCount).toBe(1)
    } finally {
      await poolSingle.terminate()
    }
  })

  it('a call cancelled right after its start lets the pool end its worker', async () => {
    const poolSingle = createWorkerConnectPool({
      createWorker: createTestWorker,
      maxCount: 1,
    })
    try {
      const busy = createBusy(poolSingle.connect)
      const abortControllerRunning = new AbortControllerFast()
      const callRunning = await startBusy(
        busy,
        BUSY_HOLD_TIME,
        abortControllerRunning.signal,
      )
      const abortControllerWaiting = new AbortControllerFast()
      const waitingEnd = busy({
        data: { data: { holdTime: 0 } },
        abortSignal: abortControllerWaiting.signal,
      }).end()
      abortControllerWaiting.abort()
      abortControllerRunning.abort()
      await expect(waitingEnd).rejects.toThrow(AbortError)
      await expect(callRunning.end()).rejects.toThrow(AbortError)
      const nextResult = await busy({ data: { data: { holdTime: 0 } } }).end()
      expect(nextResult.data.startCount).toBe(1)
    } finally {
      await poolSingle.terminate()
    }
  })

  it('a call leaves no subscription on its abort signal when it ends', async () => {
    const abortSignal = new AbortSignalMock()
    const busy = createBusy(pool.connect)
    await busy({ data: { data: { holdTime: 0 } }, abortSignal }).end()
    expect(abortSignal.subscriptionCount).toBe(0)
  })
})

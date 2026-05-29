import { afterAll, describe, expect, it } from 'vitest'
import { AbortControllerFast, AbortError } from '@flemist/abort-controller-fast'
import { createWorkerFunctionClient } from './function/createWorkerFunctionClient'
import { workerRequest } from './function/workerRequest'
import { workerRequestHandler } from './function/workerRequestHandler'
import { createWorkerConnectPool } from './connect/createWorkerConnectPool'
import type {
  WorkerFunctionTestClientEvent,
  WorkerFunctionTestInput,
  WorkerFunctionTestMultiplyRequest,
  WorkerFunctionTestMultiplyResponse,
  WorkerFunctionTestOutput,
  WorkerFunctionTestServerEvent,
} from './-test/types'
import { createWorkerVite } from './create/createWorkerVite'

const STEP_DURATION_MS = 100
const TOTAL_STEPS = 10
const WORKER_COUNT = 3
const TASKS_PER_WORKER = 3

const pool = createWorkerConnectPool({
  createWorker: () =>
    createWorkerVite(new URL('./-test/worker.ts', import.meta.url)),
  maxCount: WORKER_COUNT,
})

afterAll(async () => {
  await pool.terminate()
})

const sum = createWorkerFunctionClient<
  WorkerFunctionTestInput,
  WorkerFunctionTestOutput,
  WorkerFunctionTestClientEvent,
  WorkerFunctionTestServerEvent
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
      data: { a, b, steps: TOTAL_STEPS, stepDurationMs: STEP_DURATION_MS },
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

describe('workerFunction', { timeout: 20 * 1000 }, () => {
  it('base', async () => {
    await testParallel(false)
  })

  it('abort', async () => {
    await testParallel(true)
  })
})

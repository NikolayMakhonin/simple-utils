import { afterAll, describe, expect, it } from 'vitest'
import { AbortControllerFast, AbortError } from '@flemist/abort-controller-fast'
import { createWorkerFunctionClient } from './function/createWorkerFunctionClient'
import { createWorkerConnectPool } from './connect/createWorkerConnectPool'
import type {
  WorkerFunctionTestCallback,
  WorkerFunctionTestInput,
  WorkerFunctionTestOutput,
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
  WorkerFunctionTestCallback
>({
  connect: pool.connect,
  connectionName: 'sum',
})

async function test(a: number, b: number, useAbort: boolean): Promise<string> {
  const abortController = useAbort ? new AbortControllerFast() : null
  const progressValues: number[] = []
  let workerId: string | null = null

  const promise = sum({
    data: {
      data: { a, b, steps: TOTAL_STEPS, stepDurationMs: STEP_DURATION_MS },
    },
    abortSignal: abortController?.signal,
    callback({ data }) {
      workerId = data.workerId
      progressValues.push(data.progress)
      if (useAbort && data.progress >= 0.5) {
        abortController!.abort()
      }
    },
  })

  if (useAbort) {
    await expect(promise).rejects.toThrow(AbortError)
    expect(progressValues.length).toBeGreaterThanOrEqual(TOTAL_STEPS / 2)
    expect(progressValues.length).toBeLessThan(TOTAL_STEPS)
    expect(progressValues[progressValues.length - 1]).toBeGreaterThanOrEqual(
      0.5,
    )
    expect(progressValues[progressValues.length - 1]).toBeLessThan(1)
  } else {
    const result = await promise
    expect(result.data.result).toBe(a + b)
    expect(result.data.workerId).toBe(workerId)
    expect(result.data.completedSteps).toBe(TOTAL_STEPS)
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

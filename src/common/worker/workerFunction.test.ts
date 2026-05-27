import { describe, expect, it } from 'vitest'
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

const connect = createWorkerConnectPool({
  createWorker: () =>
    createWorkerVite(new URL('./-test/worker.ts', import.meta.url)),
  maxCount: 2,
})

const sum = createWorkerFunctionClient<
  WorkerFunctionTestInput,
  WorkerFunctionTestOutput,
  WorkerFunctionTestCallback
>({
  connect,
  connectionName: 'sum',
})

async function test(a: number, b: number, useAbort: boolean) {
  const abortController = useAbort ? new AbortControllerFast() : null
  const progressValues: number[] = []

  const promise = sum({
    data: {
      data: { a, b, steps: TOTAL_STEPS, stepDurationMs: STEP_DURATION_MS },
    },
    abortSignal: abortController?.signal,
    callback({ data }) {
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
    expect(result.data.completedSteps).toBe(TOTAL_STEPS)
    expect(progressValues.length).toBe(TOTAL_STEPS)
    expect(progressValues[0]).toBe(1 / TOTAL_STEPS)
    expect(progressValues[progressValues.length - 1]).toBe(1)
    for (let i = 1; i < progressValues.length; i++) {
      expect(progressValues[i]).toBeGreaterThan(progressValues[i - 1])
    }
  }
}

describe('workerFunction', () => {
  it('base', async () => {
    await test(1, 2, false)
  })

  it('abort', async () => {
    await test(10, 20, true)
  })
})

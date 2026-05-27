import { describe, expect, it } from 'vitest'
import { createWorkerFunctionClient } from './function/createWorkerFunctionClient'
import { createWorkerConnectPool } from './connect/createWorkerConnectPool'
import type {
  WorkerFunctionTestInput,
  WorkerFunctionTestOutput,
} from './-test/types'
const workerUrl = new URL('./-test/worker.ts', import.meta.url)
const viteWorkerUrl = new URL('./vite-worker.mts', import.meta.url)

async function createTestWorker(): Promise<Worker> {
  if (typeof Worker === 'undefined') {
    const { Worker: NodeWorker } = await import('worker_threads')
    const { fileURLToPath } = await import('url')
    return new NodeWorker(fileURLToPath(viteWorkerUrl), {
      execArgv: ['--import', 'tsx'],
      workerData: {
        scriptPath: fileURLToPath(workerUrl),
      },
    }) as unknown as Worker
  }
  return new Worker(workerUrl, { type: 'module' })
}

describe('workerFunction', () => {
  it('pool', async () => {
    const connect = createWorkerConnectPool({
      createWorker: () => createTestWorker(),
      maxCount: 2,
    })

    const sum = createWorkerFunctionClient<
      WorkerFunctionTestInput,
      WorkerFunctionTestOutput
    >({
      connect,
      connectionName: 'sum',
    })

    const results = await Promise.all([
      sum({ data: { data: { a: 1, b: 2 } } }),
      sum({ data: { data: { a: 10, b: 20 } } }),
      sum({ data: { data: { a: 100, b: 200 } } }),
    ])

    expect(results[0].data.result).toBe(3)
    expect(results[1].data.result).toBe(30)
    expect(results[2].data.result).toBe(300)
  })
})

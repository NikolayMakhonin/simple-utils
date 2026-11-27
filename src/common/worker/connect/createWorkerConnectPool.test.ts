import { describe, expect, it } from 'vitest'
import type { IWorker, WorkerConnectRelease } from '../types'
import { createWorkerConnectPool } from './createWorkerConnectPool'
import { waitMicrotasks } from 'src/common/async/wait/waitMicrotasks'

describe('createWorkerConnectPool', () => {
  /**
   * Runs the steps on a pool of fake workers: a name opens a connection
   * of that name, and '-' with a name releases that connection.
   * Expects the index of the worker that every opened connection went to
   */
  async function test(
    maxCount: number,
    steps: string[],
    expectedWorkerIndexes: number[],
  ) {
    const workerIndexes: number[] = []
    const pool = createWorkerConnectPool({
      maxCount,
      createWorker: index => new FakeWorker(index, workerIndexes),
    })
    const releases = new Map<string, WorkerConnectRelease>()
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]
      if (step.startsWith('-')) {
        releases.get(step.substring(1))!()
      } else {
        releases.set(step, pool.connect(step, new MessageChannel().port1))
      }
    }
    // The pool sends a worker its connections once the worker is created,
    // so they arrive after the steps
    await waitMicrotasks()
    expect(workerIndexes).toEqual(expectedWorkerIndexes)
  }

  it('base', async () => {
    await test(1, ['a'], [0])
    // Connections that follow one another go to the worker that the previous one freed
    await test(3, ['a', '-a', 'b', '-b', 'c'], [0, 0, 0])
    // Connections open at the same time go to workers of their own
    await test(3, ['a', 'b', 'c'], [0, 1, 2])
    // A free worker takes the connection before a new worker is created
    await test(3, ['a', 'b', '-a', 'c'], [0, 1, 0])
    await test(2, ['a', 'b', 'c', 'd', '-b', '-d', 'e'], [0, 1, 0, 1, 1])
    // With maxCount workers that hold connections, the one that holds the fewest, the first of equal ones
    await test(2, ['a', 'b', 'c', 'd'], [0, 1, 0, 1])
    await test(2, ['a', 'b', 'c', '-a', 'd'], [0, 1, 0, 0])
  })
})

/** A worker that records its index for every connection that it gets, instead of running anything */
class FakeWorker implements IWorker {
  readonly #index: number
  readonly #workerIndexes: number[]

  constructor(index: number, workerIndexes: number[]) {
    this.#index = index
    this.#workerIndexes = workerIndexes
  }

  postMessage(): void {
    this.#workerIndexes.push(this.#index)
  }

  on(): this {
    return this
  }

  off(): this {
    return this
  }

  async terminate(): Promise<void> {}
}

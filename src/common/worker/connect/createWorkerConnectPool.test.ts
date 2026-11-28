import { describe, expect, it } from 'vitest'
import type { IWorker, WorkerConnection } from '../types'
import { createWorkerConnectPool } from './createWorkerConnectPool'
import { waitMicrotasks } from 'src/common/async/wait/waitMicrotasks'

describe('createWorkerConnectPool', () => {
  /**
   * Runs the steps on a pool of fake workers: a name opens a connection
   * of that name, '-' with a name releases that connection, '!' with a name
   * cancels it, and '*' ends the pool. Expects the index of the worker that every
   * opened connection went to, the workers indexed in the order of their creation,
   * and the workers that the pool ended with the connections that it told of it
   */
  async function test(
    maxCount: number,
    steps: string[],
    expectedWorkerIndexes: number[],
    expectedTerminations?: null | ExpectedTerminations,
  ) {
    const workerIndexes: number[] = []
    const terminatedWorkerIndexes: number[] = []
    const terminatedConnectionNames: string[] = []
    let createdCount = 0
    const pool = createWorkerConnectPool({
      maxCount,
      createWorker: () =>
        new FakeWorker(createdCount++, workerIndexes, terminatedWorkerIndexes),
    })
    const connections = new Map<string, WorkerConnection>()
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]
      if (step === '*') {
        void pool.terminate()
      } else if (step.startsWith('-')) {
        connections.get(step.substring(1))!.release()
      } else if (step.startsWith('!')) {
        connections.get(step.substring(1))!.abort()
      } else {
        connections.set(
          step,
          pool.connect(step, new MessageChannel().port1, () => {
            terminatedConnectionNames.push(step)
          }),
        )
      }
    }
    // The pool sends a worker its connections, and ends it, once the worker is created,
    // so this happens after the steps
    await waitMicrotasks()
    expect(workerIndexes).toEqual(expectedWorkerIndexes)
    expect(terminatedWorkerIndexes).toEqual(
      expectedTerminations?.workerIndexes ?? [],
    )
    expect(terminatedConnectionNames).toEqual(
      expectedTerminations?.connectionNames ?? [],
    )
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

  it('abort', async () => {
    // A worker whose connections are all cancelled is ended, and they are told of it
    await test(1, ['a', '!a'], [0], {
      workerIndexes: [0],
      connectionNames: ['a'],
    })
    await test(1, ['a', 'b', '!a'], [0, 0])
    await test(1, ['a', 'b', '!a', '!b'], [0, 0], {
      workerIndexes: [0],
      connectionNames: ['a', 'b'],
    })
    // A release ends no worker, also when exclusively cancelled connections remain,
    // and the cancel that leaves exclusively cancelled ones ends it
    await test(1, ['a', 'b', '!a', '-b', 'c', '!c'], [0, 0, 0], {
      workerIndexes: [0],
      connectionNames: ['a', 'c'],
    })
    // The next connection goes to a new worker
    await test(2, ['a', 'b', '!a', 'c'], [0, 1, 2], {
      workerIndexes: [0],
      connectionNames: ['a'],
    })
    // The release of a connection of an ended worker counts nothing
    await test(1, ['a', '!a', '-a', 'b'], [0, 1], {
      workerIndexes: [0],
      connectionNames: ['a'],
    })
    // A cancelled connection that its worker closed counts no more
    await test(1, ['a', 'b', '!a', '-a', '!b'], [0, 0], {
      workerIndexes: [0],
      connectionNames: ['b'],
    })
    // The end of the pool tells the open connections
    await test(2, ['a', 'b', '-b', '*'], [0, 1], {
      workerIndexes: [0, 1],
      connectionNames: ['a'],
    })
  })

  it('a worker created after the pool ended one gets the index of the ended one', async () => {
    const createIndexes: number[] = []
    const pool = createWorkerConnectPool({
      maxCount: 3,
      createWorker: index => {
        createIndexes.push(index)
        return new FakeWorker(index, [], [])
      },
    })
    function connect(connectionName: string) {
      return pool.connect(connectionName, new MessageChannel().port1, () => {})
    }
    const connectionA = connect('a')
    connect('b')
    connect('c')
    // Ends the worker of index 0, which holds exclusively this cancelled connection
    connectionA.abort()
    connect('d')
    expect(createIndexes).toEqual([0, 1, 2, 0])
    await pool.terminate()
  })
})

/**
 * A worker that records its index for every connection that it gets,
 * and when it is ended, instead of running anything
 */
class FakeWorker implements IWorker {
  readonly #index: number
  readonly #workerIndexes: number[]
  readonly #terminatedWorkerIndexes: number[]

  constructor(
    index: number,
    workerIndexes: number[],
    terminatedWorkerIndexes: number[],
  ) {
    this.#index = index
    this.#workerIndexes = workerIndexes
    this.#terminatedWorkerIndexes = terminatedWorkerIndexes
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

  async terminate(): Promise<void> {
    this.#terminatedWorkerIndexes.push(this.#index)
  }
}

/** The workers that the pool ended, and the connections that it told of it, in their order */
type ExpectedTerminations = {
  workerIndexes: number[]
  connectionNames: string[]
}

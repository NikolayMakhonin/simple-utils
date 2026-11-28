import { describe, expect, it } from 'vitest'
import type { IWorker, WorkerConnection } from '../types'
import { createWorkerConnectPool } from './createWorkerConnectPool'
import { waitMicrotasks } from 'src/common/async/wait/waitMicrotasks'
import { ManualPromise } from 'src/common/async/promise/ManualPromise'

describe('createWorkerConnectPool', () => {
  /**
   * Runs the steps on a pool of mock workers: a name opens a connection
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
        new WorkerMock(createdCount++, workerIndexes, terminatedWorkerIndexes),
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
        return new WorkerMock(index, [], [])
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

  it('a worker that fails to start leaves the pool, and the next connection starts another one', async () => {
    const createIndexes: number[] = []
    const workerIndexes: number[] = []
    const pool = createWorkerConnectPool({
      maxCount: 1,
      createWorker: async index => {
        createIndexes.push(index)
        if (createIndexes.length === 1) {
          throw new Error('[test] start failed')
        }
        return new WorkerMock(index, workerIndexes, [])
      },
    })
    pool.connect('a', new MessageChannel().port1, () => {})
    await waitMicrotasks()
    pool.connect('b', new MessageChannel().port1, () => {})
    await waitMicrotasks()
    expect(createIndexes).toEqual([0, 0])
    expect(workerIndexes).toEqual([0])
    await pool.terminate()
  })

  it('the cancel of a connection of a worker that failed to start ends no other worker', async () => {
    const terminatedWorkerIndexes: number[] = []
    let createCount = 0
    const pool = createWorkerConnectPool({
      maxCount: 2,
      createWorker: async index => {
        createCount++
        if (createCount === 1) {
          throw new Error('[test] start failed')
        }
        return new WorkerMock(index, [], terminatedWorkerIndexes)
      },
    })
    const connectionFailed = pool.connect(
      'a',
      new MessageChannel().port1,
      () => {},
    )
    pool.connect('b', new MessageChannel().port1, () => {})
    await waitMicrotasks()
    connectionFailed.abort()
    await pool.terminate()
    expect(terminatedWorkerIndexes).toEqual([1])
  })

  it('terminate resolves when a worker fails to start while the pool ends it', async () => {
    const start = new ManualPromise<IWorker>()
    let terminateCount = 0
    const pool = createWorkerConnectPool({
      maxCount: 1,
      createWorker: () => start.promise,
    })
    pool.connect('a', new MessageChannel().port1, () => {
      terminateCount++
    })
    const terminated = pool.terminate()
    start.reject(new Error('[test] start failed'))
    await terminated
    expect(terminateCount).toBe(1)
  })

  it('a worker that reports an error is ended at once with that error, and the next connection starts another one', async () => {
    const workers: WorkerMock[] = []
    const terminatedWorkerIndexes: number[] = []
    const terminateErrors: unknown[] = []
    const pool = createWorkerConnectPool({
      maxCount: 1,
      createWorker: index => {
        const worker = new WorkerMock(index, [], terminatedWorkerIndexes)
        workers.push(worker)
        return worker
      },
    })
    function connect(connectionName: string) {
      pool.connect(connectionName, new MessageChannel().port1, error => {
        terminateErrors.push(error)
      })
    }
    connect('a')
    await waitMicrotasks()
    const workerError = new Error('[test] worker error')
    workers[0].emitError(workerError)
    await waitMicrotasks()
    expect(terminatedWorkerIndexes).toEqual([0])
    expect(terminateErrors).toStrictEqual([workerError])
    connect('b')
    expect(workers.length).toBe(2)
    // The end of the pool is no error of the worker
    await pool.terminate()
    expect(terminateErrors).toStrictEqual([workerError, undefined])
  })
})

/**
 * A worker that runs nothing. It records its index when it gets a connection
 * and when it is ended, and reports an error when a test calls emitError
 */
class WorkerMock implements IWorker {
  readonly #index: number
  readonly #workerIndexes: number[]
  readonly #terminatedWorkerIndexes: number[]
  readonly #errorListeners = new Set<(value: any) => void>()

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

  on(event: string, listener: (value: any) => void): this {
    if (event === 'error') {
      this.#errorListeners.add(listener)
    }
    return this
  }

  off(event: string, listener: (value: any) => void): this {
    if (event === 'error') {
      this.#errorListeners.delete(listener)
    }
    return this
  }

  /** Reports the error to the error listeners, as a real worker does at a failure */
  emitError(error: Error): void {
    this.#errorListeners.forEach(listener => {
      listener(error)
    })
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

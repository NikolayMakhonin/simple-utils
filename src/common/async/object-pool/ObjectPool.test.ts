import { describe, it, assert } from 'vitest'
import { createTestVariants } from '@flemist/test-variants'
import { delay } from 'src/common/async/wait/delay'
import {
  AbortControllerFast,
  type IAbortSignalFast,
} from '@flemist/abort-controller-fast'
import { type IObjectPool, ObjectPool } from './ObjectPool'
import { Pool } from 'src/common/async/pool/Pool'
import { Pools } from 'src/common/async/pool/Pools'
import { TimeControllerMock } from '@flemist/time-controller'
import { waitTimeControllerMock } from 'src/common/async/wait/waitTimeControllerMock'
import { createAwaitPriority } from 'src/common/async/priority-queue/helpers'

describe('object-pool > ObjectPool', () => {
  let iteration = 0

  const testVariants = createTestVariants(
    async ({
      withPriorityQueue,
      countObjects,
      usePools,
      heldObjects,
      preAllocateSize,
      abort,
      async,
      maxSize,
    }: {
      withPriorityQueue?: null | boolean
      countObjects: number
      usePools: boolean
      heldObjects: boolean
      preAllocateSize?: null | number
      abort: null | 'before' | 'after'
      async: boolean
      maxSize: number
    }) => {
      iteration++

      const timeController = new TimeControllerMock()
      const awaitPriority = withPriorityQueue ? createAwaitPriority() : null

      const promises: Promise<number>[] = []

      type IObject = {
        id: number
      }

      let objectsCount = 0
      const createObject: () => Promise<IObject> | IObject = async
        ? async function createObject(): Promise<IObject> {
            objectsCount++
            assert.ok(objectsCount <= maxSize)
            await delay(1, null, timeController)
            return {
              id: objectsCount,
            }
          }
        : function createObject(): IObject {
            objectsCount++
            assert.ok(objectsCount <= maxSize)
            return {
              id: objectsCount,
            }
          }

      const pool = usePools
        ? new Pools(
            new Pool(maxSize),
            new Pools(new Pool(maxSize), new Pool(maxSize + 1)),
            new Pool(maxSize + 2),
          )
        : new Pool(maxSize)

      const objectPool: IObjectPool<IObject> = new ObjectPool<IObject>({
        pool,
        heldObjects,
        create: createObject,
        destroy: null,
      })

      assert.strictEqual(objectPool.pool.heldCountMax, maxSize)
      assert.strictEqual(objectPool.pool.holdAvailable, maxSize)
      if (heldObjects) {
        assert.strictEqual(objectPool.heldObjects!.size, 0)
      } else {
        assert.strictEqual(objectPool.heldObjects, null)
      }
      assert.strictEqual(objectPool.availableObjects.length, 0)
      if (preAllocateSize != null) {
        await Promise.race([
          objectPool.allocate(preAllocateSize),
          waitTimeControllerMock(timeController, null, {
            timeout: 1,
            awaitsPerIteration: 4,
          }).then(() => {
            throw new Error('Timeout')
          }),
        ])
        assert.strictEqual(objectPool.pool.heldCountMax, maxSize)
        assert.strictEqual(objectPool.pool.holdAvailable, maxSize)
        if (heldObjects) {
          assert.strictEqual(objectPool.heldObjects!.size, 0)
        } else {
          assert.strictEqual(objectPool.heldObjects, null)
        }
        assert.strictEqual(
          objectPool.availableObjects.length,
          preAllocateSize == null
            ? maxSize
            : Math.min(maxSize, preAllocateSize),
        )
      }

      const activeObjects = new Set<IObject>()
      function createFunc(result: number) {
        return async
          ? async function func(
              objects: readonly IObject[],
              abortSignal?: null | IAbortSignalFast,
            ) {
              assert.strictEqual(objects.length, countObjects)
              assert.ok(objects.every(o => o))
              assert.ok(objects.every(o => typeof o.id === 'number'))
              assert.ok(objects.every(o => o.id <= maxSize))

              assert.ok(objects.every(o => !activeObjects.has(o)))
              objects.forEach(o => {
                activeObjects.add(o)
              })
              assert.ok(activeObjects.size <= maxSize)
              assert.ok(
                objectPool.pool.holdAvailable < objectPool.pool.heldCountMax,
              )
              assert.ok(objectPool.availableObjects.length < maxSize)
              activeObjects.forEach(o => {
                assert.ok(!objectPool.availableObjects.includes(o))
              })
              if (heldObjects) {
                activeObjects.forEach(o => {
                  assert.ok(objectPool.heldObjects!.has(o))
                })
                objectPool.availableObjects.forEach(o => {
                  assert.ok(!objectPool.heldObjects!.has(o))
                })
                assert.ok(objectPool.heldObjects!.size <= maxSize)
              } else {
                assert.strictEqual(objectPool.heldObjects, null)
              }

              await delay(1, null, timeController)

              if (abort) {
                assert.ok(abortSignal!.aborted)
              }

              assert.ok(
                objectPool.pool.holdAvailable < objectPool.pool.heldCountMax,
              )
              assert.ok(objectPool.availableObjects.length < maxSize)
              activeObjects.forEach(o => {
                assert.ok(!objectPool.availableObjects.includes(o))
              })
              if (heldObjects) {
                activeObjects.forEach(o => {
                  assert.ok(objectPool.heldObjects!.has(o))
                })
                objectPool.availableObjects.forEach(o => {
                  assert.ok(!objectPool.heldObjects!.has(o))
                })
                assert.ok(objectPool.heldObjects!.size <= maxSize)
              } else {
                assert.strictEqual(objectPool.heldObjects, null)
              }
              assert.ok(objects.every(o => activeObjects.has(o)))
              objects.forEach(o => {
                activeObjects.delete(o)
              })
              assert.ok(activeObjects.size < maxSize)

              return result
            }
          : function func(
              objects: readonly IObject[],
              abortSignal?: null | IAbortSignalFast,
            ) {
              if (abort) {
                assert.ok(abortSignal!.aborted)
              }

              assert.ok(objects.every(o => o))
              assert.ok(objects.every(o => typeof o.id === 'number'))
              assert.ok(objects.every(o => o.id <= maxSize))

              assert.ok(objects.every(o => !activeObjects.has(o)))
              objects.forEach(o => {
                activeObjects.add(o)
              })

              assert.ok(activeObjects.size <= maxSize)
              assert.ok(objectPool.availableObjects.length < maxSize)
              activeObjects.forEach(o => {
                assert.ok(!objectPool.availableObjects.includes(o))
              })
              if (heldObjects) {
                activeObjects.forEach(o => {
                  assert.ok(objectPool.heldObjects!.has(o))
                })
                objectPool.availableObjects.forEach(o => {
                  assert.ok(!objectPool.heldObjects!.has(o))
                })
                assert.ok(objectPool.heldObjects!.size <= maxSize)
              } else {
                assert.strictEqual(objectPool.heldObjects, null)
              }
              objects.forEach(o => {
                activeObjects.delete(o)
              })

              return result
            }
      }

      const totalCount = maxSize * 5
      for (let i = 0; i < totalCount; i++) {
        const func = createFunc(i + 10000 * iteration)
        const abortController = abort && new AbortControllerFast()
        if (abortController && abort === 'before') {
          abortController.abort(i + 10000 * iteration)
        }
        let promise = objectPool.use(
          countObjects,
          func,
          null,
          abortController?.signal,
          awaitPriority,
        )
        if (abort) {
          promise = promise.catch(o => o)
        }
        promises.push(promise)
        if (abortController && abort === 'after') {
          abortController.abort(i + 10000 * iteration)
        }
      }

      const results = await Promise.race([
        Promise.all(promises),
        waitTimeControllerMock(timeController, null, {
          timeout: totalCount + countObjects,
          awaitsPerIteration: 34,
        }).then(() => {
          throw new Error('Timeout')
        }),
      ])

      assert.strictEqual(activeObjects.size, 0)
      assert.strictEqual(objectPool.pool.heldCountMax, maxSize)
      assert.strictEqual(objectPool.pool.holdAvailable, maxSize)

      for (let i = 0; i < totalCount; i++) {
        assert.strictEqual(results[i], i + 10000 * iteration)
      }
    },
  )

  it('variants', { timeout: 600000 }, async () => {
    await testVariants({
      withPriorityQueue: typeof window !== 'undefined' ? [true] : [true, false],
      countObjects: [1, 2, 3, 5],
      usePools: [false, true],
      heldObjects: [false, true],
      preAllocateSize: [void 0, null, 0, 1, 2, 5],
      abort: [null, 'before', 'after'],
      async: [false, true],
      maxSize: ({ countObjects }) => [0, 1, 4].map(o => o + countObjects),
    })()
  })
})

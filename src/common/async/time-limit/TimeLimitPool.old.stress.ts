import { describe, it, assert } from 'vitest'
import { delay } from 'src/common/async/wait/delay'
import { priorityCreate } from 'src/common/async/priority/Priority'
import { TimeControllerMock } from '@flemist/time-controller'
import { type IAbortSignalFast } from '@flemist/abort-controller-fast'
import { createTestVariants } from '@flemist/test-variants'
import { Pool } from 'src/common/async/pool/Pool'
import { poolRunWait } from 'src/common/async/pool/poolRunWait'
import { Pools } from 'src/common/async/pool/Pools'
import { TimeLimitPool } from './TimeLimitPool'
import { waitTimeControllerMock } from 'src/common/async/wait/waitTimeControllerMock'

describe('time-limits > TimeLimits Old', { timeout: 300000 }, () => {
  type Mode = 'sync' | 'async' | 'random'

  async function awaiter() {
    for (let i = 0; i < 40; i++) {
      await Promise.resolve()
    }
  }

  const testVariants = createTestVariants(
    async ({
      timeLimitsTree,
      mode,
      asyncTime,
      maxCount,
      timeMs,
    }: {
      timeLimitsTree?: null | boolean
      mode: Mode
      asyncTime: number
      maxCount: number
      timeMs: number
    }) => {
      const timeController = new TimeControllerMock()
      const timeLimitPool = timeLimitsTree
        ? new Pools(
            new TimeLimitPool({
              pool: new Pool(maxCount),
              time: timeMs,
              timeController,
            }),
            new Pools(
              new Pools(
                new TimeLimitPool({
                  pool: new Pool(maxCount),
                  time: timeMs,
                  timeController,
                }),
                new TimeLimitPool({
                  pool: new Pool(maxCount),
                  time: timeMs,
                  timeController,
                }),
              ),
              new TimeLimitPool({
                pool: new Pool(maxCount),
                time: timeMs,
                timeController,
              }),
            ),
          )
        : new TimeLimitPool({
            pool: new Pool(maxCount),
            time: timeMs,
            timeController,
          })

      let completedCount = 0

      const run = function run(
        result: number,
        delayMs: number,
        abortSignal?: null | IAbortSignalFast,
      ) {
        if (delayMs) {
          return delay(delayMs, abortSignal, timeController).then(() => {
            completedCount++
            return result
          })
        }
        completedCount++
        return result
      }

      assert.strictEqual(completedCount, 0)
      const promises: Promise<void>[] = []
      const results: number[] = []
      for (let i = 0, len = maxCount * 3; i < len; i++) {
        const index = i
        const order = len - 1 - i
        const async =
          mode === 'async' || (mode === 'random' && Math.random() > 0.5)
        const result = poolRunWait({
          pool: timeLimitPool,
          count: 1,
          func: ({ abortSignal }) => {
            return run(index, async ? asyncTime : 0, abortSignal)
          },
          priority: priorityCreate(order),
        })
        assert.ok(typeof result.then === 'function')
        promises.push(
          result.then(o => {
            assert.strictEqual(o, index)
            results.push(order)
          }),
        )
      }

      // delay(0) returns Promise.resolve() without calling timeController.setTimeout, so releases propagate through microtasks;
      // waitTimeControllerMock is still needed to advance mock time for async func delays (asyncTime)
      if (timeMs === 0) {
        await waitTimeControllerMock(timeController, Promise.all(promises), {
          awaitsPerIteration: 12,
        })
        assert.strictEqual(completedCount, maxCount * 3)
      } else {
        await awaiter()

        if (mode === 'async' || mode === 'random') {
          timeController.addTime(asyncTime)
        }
        await awaiter()
        await awaiter()
        assert.strictEqual(completedCount, maxCount)

        timeController.addTime(timeMs)
        await awaiter()
        if (mode === 'async' || mode === 'random') {
          timeController.addTime(asyncTime)
          await awaiter()
        }
        assert.strictEqual(completedCount, maxCount * 2)

        timeController.addTime(timeMs)
        await awaiter()
        if (mode === 'async' || mode === 'random') {
          timeController.addTime(asyncTime)
          await awaiter()
        }
        assert.strictEqual(completedCount, maxCount * 3)

        timeController.addTime(timeMs)
        await awaiter()
        if (mode === 'async' || mode === 'random') {
          timeController.addTime(asyncTime)
          await awaiter()
        }
        assert.strictEqual(completedCount, maxCount * 3)

        await Promise.all(promises)
      }

      if (mode !== 'random' || maxCount > 5) {
        assert.ok(
          results.every((o, i) => o === i) === (mode !== 'random'),
          results.join(', '),
        )
      }
    },
  )

  it.skip('custom', async () => {
    await testVariants({
      mode: ['async'],
      maxCount: [1],
      timeLimitsTree: [false],
      asyncTime: [500],
      timeMs: [1000],
    })()
  })

  it('variants', async () => {
    await testVariants({
      timeLimitsTree: [false, true],
      mode: ['sync', 'async', 'random'],
      asyncTime: ({ mode }) => {
        return mode === 'async' ? [5] : mode === 'random' ? [2] : [0]
      },
      maxCount: [1, 2, 3, 10],
      timeMs: ({ mode }) => (mode === 'random' ? [3, 5, 10] : [0, 1, 2, 5, 10]),
    })({ timeout: 2000 })
  })
})

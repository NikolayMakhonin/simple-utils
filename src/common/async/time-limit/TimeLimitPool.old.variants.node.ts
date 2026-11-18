import { describe, it, assert } from 'vitest'
import { delay } from 'src/common/async/wait/delay'
import { priorityCreate } from 'src/common/async/priority/Priority'
import { DateTimeMock } from 'src/common/time/date-time'
import { type IAbortSignalFast } from '@flemist/abort-controller-fast'
import { createTestVariants } from '@flemist/test-variants'
import { Pool } from 'src/common/async/pool/Pool'
import { poolRunWait } from 'src/common/async/pool/poolRunWait'
import { Pools } from 'src/common/async/pool/Pools'
import { TimeLimitPool } from './TimeLimitPool'
import { waitTimeMock } from 'src/common/async/wait/waitTimeMock'

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
      const dateTime = new DateTimeMock()
      const timeLimitPool = timeLimitsTree
        ? new Pools(
            new TimeLimitPool({
              pool: new Pool(maxCount),
              time: timeMs,
              dateTime,
            }),
            new Pools(
              new Pools(
                new TimeLimitPool({
                  pool: new Pool(maxCount),
                  time: timeMs,
                  dateTime,
                }),
                new TimeLimitPool({
                  pool: new Pool(maxCount),
                  time: timeMs,
                  dateTime,
                }),
              ),
              new TimeLimitPool({
                pool: new Pool(maxCount),
                time: timeMs,
                dateTime,
              }),
            ),
          )
        : new TimeLimitPool({
            pool: new Pool(maxCount),
            time: timeMs,
            dateTime,
          })

      let completedCount = 0

      const run = function run(
        result: number,
        delayMs: number,
        abortSignal?: null | IAbortSignalFast,
      ) {
        if (delayMs) {
          return delay(delayMs, abortSignal, dateTime).then(() => {
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

      // delay(0) returns Promise.resolve() without calling dateTime.time.setTimeout, so releases propagate through microtasks;
      // waitTimeMock is still needed to advance mock time for async func delays (asyncTime)
      if (timeMs === 0) {
        await waitTimeMock(dateTime.time, Promise.all(promises), {
          awaitsPerIteration: 12,
        })
        assert.strictEqual(completedCount, maxCount * 3)
      } else {
        await awaiter()

        if (mode === 'async' || mode === 'random') {
          dateTime.time.addTime(asyncTime)
        }
        await awaiter()
        await awaiter()
        assert.strictEqual(completedCount, maxCount)

        dateTime.time.addTime(timeMs)
        await awaiter()
        if (mode === 'async' || mode === 'random') {
          dateTime.time.addTime(asyncTime)
          await awaiter()
        }
        assert.strictEqual(completedCount, maxCount * 2)

        dateTime.time.addTime(timeMs)
        await awaiter()
        if (mode === 'async' || mode === 'random') {
          dateTime.time.addTime(asyncTime)
          await awaiter()
        }
        assert.strictEqual(completedCount, maxCount * 3)

        dateTime.time.addTime(timeMs)
        await awaiter()
        if (mode === 'async' || mode === 'random') {
          dateTime.time.addTime(asyncTime)
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

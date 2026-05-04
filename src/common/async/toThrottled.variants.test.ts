import { describe, it } from 'vitest'
import { createTestVariants } from '@flemist/test-variants'
import { TimeControllerMock } from '@flemist/time-controller'
import { createTaskThrottled } from './types'
import { waitTimeControllerMock } from '@flemist/async-utils'

describe('toThrottled', () => {
  function checkTimeStamps({
    timeStamps,
    throttleTimeMin,
    throttleTimeMax,
    throttleFromEnd,
  }: {
    timeStamps: { start: number; end: number }[]
    throttleTimeMin: number | null
    throttleTimeMax: number | null
    throttleFromEnd: boolean
  }) {
    if (throttleTimeMin == null) {
      throttleTimeMin = 0
    }
    for (let i = 1; i < timeStamps.length; i++) {
      const { start } = timeStamps[i]
      const prev = timeStamps[i - 1]
      const referenceTime = throttleFromEnd ? prev.end : prev.start
      const deltaTime = start - referenceTime
      if (deltaTime < throttleTimeMin) {
        throw new Error(
          `${i}: deltaTime(${start} - ${referenceTime} = ${deltaTime}) < throttleTimeMin(${throttleTimeMin})` +
            `; throttleFromEnd=${throttleFromEnd}: ${JSON.stringify(timeStamps)}`,
        )
      }
    }
  }

  const EXECUTION_DURATION = 3

  const testVariants = createTestVariants(
    async ({
      throttleTimeDefault,
      throttleTimeMax,
      throttleTimeRange,
      throttleFromEnd,
    }: {
      throttleTimeDefault: number | null
      throttleTimeMax: number | null
      /** If set, overrides throttleTimeDefault and throttleTimeMax with random value from the range */
      throttleTimeRange: [number, number] | null
      throttleFromEnd: boolean
    }) => {
      const timeController = new TimeControllerMock()
      const timeStamps: { start: number; end: number }[] = []
      const startTime = timeController.now()
      const func = async () => {
        const funcStart = timeController.now() - startTime
        timeController.addTime(EXECUTION_DURATION)
        timeStamps.push({
          start: funcStart,
          end: timeController.now() - startTime,
        })
      }

      const task = createTaskThrottled<any, any, any, any>(func, null, {
        throttleTimeDefault,
        throttleTimeMax,
        throttleFromEnd,
        timeController,
      })

      let delayMax = throttleTimeMax!
      if (throttleTimeRange != null) {
        delayMax = Math.max(throttleTimeRange[0], throttleTimeMax ?? 0)
      }
      if (delayMax == null) {
        delayMax = 100
      }

      const promises: Promise<any>[] = []

      for (let i = 0; i < 100; i++) {
        // await timeControllerAwait(timeController, {
        //   iterations   : Math.floor(Math.random() * 10),
        //   getAddTime   : () => Math.floor(Math.random() * 10),
        //   getAwaitCount: () => Math.floor(Math.random() * 10),
        // })
        await waitTimeControllerMock(timeController, null, {
          timeout: Math.floor(Math.random() * 10),
          awaitsPerIteration: Math.floor(Math.random() * 100),
        })

        const throttleTime = throttleTimeRange
          ? throttleTimeRange[0] +
            Math.random() * (throttleTimeRange[1] - throttleTimeRange[0])
          : null
        promises.push(task.run({ throttleTime }))
      }

      // await timeControllerAwaitPromise(timeController, Promise.all(promises), {
      //   iterations: 500,
      // })
      await waitTimeControllerMock(timeController, Promise.all(promises), {
        awaitsPerIteration: 1,
      })

      // await Promise.all(promises)

      let throttleTimeMin = throttleTimeRange
        ? throttleTimeRange[0]
        : (throttleTimeDefault ?? 0)
      if (throttleTimeMax != null) {
        throttleTimeMin = Math.min(throttleTimeMin, throttleTimeMax)
      }

      checkTimeStamps({
        timeStamps,
        throttleTimeMin,
        throttleTimeMax: Math.max(
          throttleTimeMin,
          throttleTimeMax ?? 0,
          delayMax,
        ),
        throttleFromEnd,
      })
    },
  )

  it('throttleFromEnd contract', async () => {
    const throttleTime = 10

    for (const throttleFromEnd of [false, true]) {
      const timeController = new TimeControllerMock()
      const timeStamps: { start: number; end: number }[] = []
      const startTime = timeController.now()
      const func = async () => {
        const funcStart = timeController.now() - startTime
        timeController.addTime(EXECUTION_DURATION)
        timeStamps.push({
          start: funcStart,
          end: timeController.now() - startTime,
        })
      }

      const task = createTaskThrottled(func, null, {
        throttleTimeDefault: throttleTime,
        throttleFromEnd,
        timeController,
      })

      // Clause 3: throttleFromEnd=true executes immediately when never executed
      await waitTimeControllerMock(
        timeController,
        Promise.resolve(task.run({})),
        {
          awaitsPerIteration: 1,
        },
      )
      if (throttleFromEnd && timeStamps[0].start !== 0) {
        throw new Error(
          `throttleFromEnd=true: first execution must be immediate, but start=${timeStamps[0].start}`,
        )
      }

      // Run more executions for clause 1/2 verification
      for (let i = 1; i < 5; i++) {
        await waitTimeControllerMock(
          timeController,
          Promise.resolve(task.run({})),
          {
            awaitsPerIteration: 1,
          },
        )
      }

      // Clauses 1/2: verify throttle reference point
      for (let i = 1; i < timeStamps.length; i++) {
        const prev = timeStamps[i - 1]
        const curr = timeStamps[i]
        const deltaFromStart = curr.start - prev.start
        const deltaFromEnd = curr.start - prev.end

        if (throttleFromEnd) {
          if (deltaFromEnd < throttleTime) {
            throw new Error(
              `${i}: throttleFromEnd=true: deltaFromEnd(${deltaFromEnd}) < throttleTime(${throttleTime}): ${JSON.stringify(timeStamps)}`,
            )
          }
        } else {
          if (deltaFromStart < throttleTime) {
            throw new Error(
              `${i}: throttleFromEnd=false: deltaFromStart(${deltaFromStart}) < throttleTime(${throttleTime}): ${JSON.stringify(timeStamps)}`,
            )
          }
          if (deltaFromEnd >= throttleTime) {
            throw new Error(
              `${i}: throttleFromEnd=false: deltaFromEnd(${deltaFromEnd}) >= throttleTime(${throttleTime}), throttle should count from start not end: ${JSON.stringify(timeStamps)}`,
            )
          }
        }
      }

      // Clause 4: throttleFromEnd=true executes immediately when enough time passed
      if (throttleFromEnd) {
        const lastEnd = timeStamps[timeStamps.length - 1].end
        timeController.addTime(throttleTime + 5)
        const timeBefore = timeController.now() - startTime
        await waitTimeControllerMock(
          timeController,
          Promise.resolve(task.run({})),
          {
            awaitsPerIteration: 1,
          },
        )
        const lastStamp = timeStamps[timeStamps.length - 1]
        if (lastStamp.start !== timeBefore) {
          throw new Error(
            `throttleFromEnd=true: should execute immediately when enough time passed` +
              `; expected start=${timeBefore}, got start=${lastStamp.start}: ${JSON.stringify(timeStamps)}`,
          )
        }
      }
    }
  })

  it('variants', { timeout: 10 * 60 * 1000 }, async () => {
    for (let i = 0; i < 10; i++) {
      const result = await testVariants({
        throttleTimeDefault: [null, 0, 5, 10],
        throttleTimeMax: [null, 0, 5, 10, 20],
        throttleTimeRange: [null, [2, 3], [2, 10], [0, 2]],
        throttleFromEnd: [false, true],
      })()

      console.log('iterations:', result.iterations)
    }
  })
})

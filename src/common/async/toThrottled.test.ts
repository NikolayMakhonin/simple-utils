import { createTestVariants } from '@flemist/test-variants'
import { TimeControllerMock } from '@flemist/time-controller'
import { toThrottled } from './toThrottled'
import { waitTimeControllerMock } from 'src/wait/waitTimeControllerMock'

describe('toThrottled', () => {
  function checkTimeStamps({
    timeStamps,
    throttleTimeMin,
    throttleTimeMax,
    skipFirst,
  }: {
    timeStamps: number[]
    throttleTimeMin: number | null
    throttleTimeMax: number | null
    skipFirst: boolean
  }) {
    if (throttleTimeMin == null) {
      throttleTimeMin = 0
    }
    let prevTime = 0
    for (let i = 0; i < timeStamps.length; i++) {
      const time = timeStamps[i]
      const deltaTime = time - prevTime
      if (i === 0 && skipFirst) {
        if (deltaTime < throttleTimeMin * 2) {
          throw new Error(
            `${i}: deltaTime(${time} - ${prevTime} = ${deltaTime})) < throttleTimeMin(${throttleTimeMin}) * 2: ${JSON.stringify(
              timeStamps,
            )}`,
          )
        }
        if (throttleTimeMax != null && deltaTime > throttleTimeMax * 2) {
          // throw new Error(
          //   `${i}: deltaTime(${time} - ${prevTime} = ${deltaTime})) > throttleTimeMax(${throttleTimeMax}) * 2: ${JSON.stringify(
          //     timeStamps,
          //   )}`,
          // )
        }
        continue
      }
      if (deltaTime < throttleTimeMin) {
        throw new Error(
          `${i}: deltaTime(${time} - ${prevTime} = ${deltaTime}) < throttleTimeMin(${throttleTimeMin}): ${JSON.stringify(
            timeStamps,
          )}`,
        )
      }
      if (throttleTimeMax != null && deltaTime > throttleTimeMax) {
        // throw new Error(
        //   `${i}: deltaTime(${deltaTime}) > throttleTimeMax(${throttleTimeMax}): ${JSON.stringify(
        //     timeStamps,
        //   )}`,
        // )
      }
      prevTime = time
    }
  }

  const testVariants = createTestVariants(
    async ({
      throttleTimeDefault,
      throttleTimeMax,
      throttleTimeRange,
      skipFirst,
    }: {
      throttleTimeDefault: number | null
      throttleTimeMax: number | null
      throttleTimeRange: [number, number] | null
      skipFirst: boolean
    }) => {
      const timeController = new TimeControllerMock()
      const timeStamps: number[] = []
      const startTime = timeController.now()
      const func = async () => {
        timeStamps.push(timeController.now() - startTime)
      }

      const throttleFunc = toThrottled<any>({
        throttleTimeDefault,
        throttleTimeMax,
        func,
        skipFirst,
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
        promises.push(throttleFunc(null, { throttleTime }))
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
        skipFirst,
      })
    },
  )

  it('base', async function () {
    this.timeout(10 * 60 * 1000)
    for (let i = 0; i < 10; i++) {
      const result = await testVariants({
        throttleTimeDefault: [null, 0, 5, 10],
        throttleTimeMax: [null, 0, 5, 10, 20],
        throttleTimeRange: [null, [2, 3], [2, 10], [0, 2]],
        skipFirst: [false, true],
      })()

      console.log('iterations:', result.iterations)
    }
  })
})

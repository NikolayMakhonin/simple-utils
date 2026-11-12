import { describe, it, assert } from 'vitest'
import { createTestVariants } from '@flemist/test-variants'
import { delay } from 'src/common/async/wait/delay'
import type { ITimeController } from './contracts'
import { timeControllerDefault } from './TimeControllerDefault'
import { TimeControllerMock } from './TimeControllerMock'

describe('time-controller > TimeControllerMock', () => {
  function test({
    timeController,
    times,
    postDelay,
    resolve,
  }: TestOptions): number {
    const result: string[] = []
    let timeMax = 0
    for (let i = 0, len = times.length; i < len; i++) {
      const time = times[i]
      timeMax = Math.max(
        timeMax,
        (time.start ?? 0) + Math.max(time.timeout, time.abort ?? 0),
      )

      function start() {
        const handle = timeController.setTimeout(() => {
          result.push(`completed: ${time.index}`)
        }, time.timeout)

        if (time.abort != null) {
          if (time.abort < 0) {
            timeController.clearTimeout(handle)
          } else {
            timeController.setTimeout(() => {
              timeController.clearTimeout(handle)
              result.push(`aborted: ${time.index}`)
            }, time.abort)
          }
        }
      }

      if (time.start == null) {
        start()
      } else {
        timeController.setTimeout(start, time.start)
      }
    }

    timeController.setTimeout(() => {
      resolve(result)
    }, timeMax + postDelay)

    return timeMax + postDelay
  }

  function createTimes({
    time1Start,
    time1Timeout,
    time1Abort,
    time2Start,
    time2Timeout,
    time2Abort,
    time3Start,
    time3Timeout,
    time3Abort,
  }: TestTimesArgs): [TestTime[]] {
    const times: TestTime[] = []
    let index = 0
    if (time1Timeout != null) {
      times.push({
        index,
        start: time1Start,
        timeout: time1Timeout,
        abort: time1Abort,
      })
      index++
    }
    if (time2Timeout != null) {
      times.push({
        index,
        start: time2Start,
        timeout: time2Timeout,
        abort: time2Abort,
      })
      index++
    }
    if (time3Timeout != null) {
      times.push({
        index,
        start: time3Start,
        timeout: time3Timeout,
        abort: time3Abort,
      })
    }

    return [times]
  }

  function createExpectedResult({ times }: TestExpectedResultArgs): [string[]] {
    const events: TestEvent[] = []
    times.forEach(time => {
      if (time.abort != null && time.abort < 0) {
        return
      }
      if (time.abort == null || time.abort >= time.timeout) {
        events.push({
          time: (time.start ?? 0) + time.timeout,
          start: time.start,
          index: time.index * 2,
          event: `completed: ${time.index}`,
        })
      }
      if (time.abort != null) {
        events.push({
          time: (time.start ?? 0) + time.abort,
          start: time.start,
          index: time.index * 2 + 1,
          event: `aborted: ${time.index}`,
        })
      }
    })
    events.sort(compareEvents)

    return [events.map(o => o.event)]
  }

  function compareEvents(a: TestEvent, b: TestEvent): number {
    if (a.time !== b.time) {
      return a.time > b.time ? 1 : -1
    }
    if (a.start !== b.start) {
      if (a.start == null) {
        return -1
      }
      if (b.start == null) {
        return 1
      }
      return a.start > b.start ? 1 : -1
    }
    if (a.index !== b.index) {
      return a.index > b.index ? 1 : -1
    }
    throw new Error(
      '[test][compareEvents] events have equal time, start, and index',
    )
  }

  const testVariants = createTestVariants(
    ({ times, step1, step2, step3, expectedResult }: TestVariantsArgs) => {
      const steps = [step1, step2, step3].filter(o => o != null)

      const timeController = new TimeControllerMock()

      let result: string[] = null!
      let expectedTime = test({
        timeController,
        times,
        postDelay: 0,
        resolve: o => {
          result = o
        },
      })

      for (let i = 0, len = steps.length; i < len; i++) {
        const step = steps[i]
        expectedTime -= step
        timeController.addTime(step)
      }
      timeController.addTime(Math.max(0, expectedTime))

      assert.deepStrictEqual(result, expectedResult)
    },
  )

  const testVariantsExpectedResult = createTestVariants(
    async ({ times, expectedResult }: TestVariantsExpectedResultArgs) => {
      if (times.length === 0) {
        return
      }

      const result = await new Promise<string[]>(resolve => {
        test({
          timeController: timeControllerDefault,
          times,
          postDelay: 100,
          resolve,
        })
      })

      assert.deepStrictEqual(result, expectedResult)
    },
  )

  it('setTimeout order', async () => {
    const result: number[] = []
    for (let i = 0; i < 100; i++) {
      setTimeout(() => result.push(4), 3)
      setTimeout(() => result.push(5), 3)
      setTimeout(() => result.push(6), 3)
      setTimeout(() => result.push(1), 0)
      setTimeout(() => result.push(2), 0)
      setTimeout(() => result.push(3), 0)
      await delay(10)
      assert.deepStrictEqual(result, [1, 2, 3, 4, 5, 6])
      result.length = 0
    }
  })

  it(
    'createExpectedResult matches timeControllerDefault',
    { timeout: 600000000 },
    async () => {
      await testVariantsExpectedResult({
        time3Timeout: [null, 0, 170],
        time3Start: ({ time3Timeout }) =>
          time3Timeout == null ? [null] : [null, 0, 170],
        time3Abort: ({ time3Timeout }) =>
          time3Timeout == null ? [null] : [null, -1, 0, 170],

        time2Timeout: [null, 0, 70],
        time2Start: ({ time2Timeout }) =>
          time2Timeout == null ? [null] : [null, 0, 70],
        time2Abort: ({ time2Timeout }) =>
          time2Timeout == null ? [null] : [null, -1, 0, 70],

        time1Timeout: [null, 0, 50],
        time1Start: ({ time1Timeout }) =>
          time1Timeout == null ? [null] : [null, 0, 50],
        time1Abort: ({ time1Timeout }) =>
          time1Timeout == null ? [null] : [null, -1, 0, 50],

        times: createTimes,
        expectedResult: createExpectedResult,
      })()
    },
  )

  it('base', { timeout: 900000 }, async () => {
    await testVariants({
      time3Timeout: [null, 0, 1, 2],
      time3Start: ({ time3Timeout }) =>
        time3Timeout == null ? [null] : [null, 0, 1, 2],
      time3Abort: ({ time3Timeout }) =>
        time3Timeout == null ? [null] : [null, -1, 0, 1, 2],

      time2Timeout: [null, 0, 1, 2],
      time2Start: ({ time2Timeout }) =>
        time2Timeout == null ? [null] : [null, 0, 1, 2],
      time2Abort: ({ time2Timeout }) =>
        time2Timeout == null ? [null] : [null, -1, 0, 1, 2],

      time1Timeout: [null, 0, 1, 2],
      time1Start: ({ time1Timeout }) =>
        time1Timeout == null ? [null] : [null, 0, 1, 2],
      time1Abort: ({ time1Timeout }) =>
        time1Timeout == null ? [null] : [null, -1, 0, 1, 2],

      times: createTimes,
      expectedResult: createExpectedResult,
      step1: [null, 0, 1, 2],
      step2: [null, 0, 1, 2],
      step3: [null, 0, 1, 2],
    })()
  })
})

type TestTime = {
  index: number
  start: number | null
  timeout: number
  abort: number | null
}

type TestOptions = {
  timeController: ITimeController
  times: TestTime[]
  postDelay: number
  resolve: (result: string[]) => void
}

type TestTimesArgs = {
  time1Start: number | null
  time1Timeout: number | null
  time1Abort: number | null
  time2Start: number | null
  time2Timeout: number | null
  time2Abort: number | null
  time3Start: number | null
  time3Timeout: number | null
  time3Abort: number | null
}

type TestExpectedResultArgs = {
  times: TestTime[]
}

type TestEvent = {
  time: number
  start: number | null
  index: number
  event: string
}

type TestVariantsArgs = TestTimesArgs & {
  times: TestTime[]
  step1: number | null
  step2: number | null
  step3: number | null
  expectedResult: string[]
}

type TestVariantsExpectedResultArgs = TestTimesArgs & {
  times: TestTime[]
  expectedResult: string[]
}

import { describe, it, assert } from 'vitest'
import { PriorityQueue } from './PriorityQueue'
import { priorityCreate } from 'src/common/async/priority/Priority'
import { createTestVariants } from '@flemist/test-variants'
import {
  type IAbortSignalFast,
  type IAbortControllerFast,
  AbortControllerFast,
} from '@flemist/abort-controller-fast'
import {
  type ITimeController,
  TimeControllerMock,
} from '@flemist/time-controller'
import { delay } from '../wait'

describe(
  'priority-queue > PriorityQueue',
  { timeout: 30_000 },
  function _describe() {
    it('base', async () => {
      const queue = new PriorityQueue()
      const log: string[] = []

      let whileCount = 0
      async function test(index: number, order: number) {
        do {
          log.push('run' + index)
          // console.log('run' + index)
          await queue.run(() => {
            log.push('tick' + index)
            // console.log('tick' + index)
          }, priorityCreate(order))
          log.push('check' + index)
          // console.log('check' + index)
        } while (whileCount++ % 2 === 0)

        log.push('end' + index)
        // console.log('end' + index)
      }

      const promises: Promise<void>[] = []
      const count = 10
      for (let i = 0; i < count; i++) {
        promises.push(test(i, count - 1 - i))
      }

      await Promise.all(promises)

      for (let i = 0; i < count; i++) {
        assert.strictEqual(log[i], 'run' + i)
      }

      let prevIndex = count - 1
      for (let i = count; i < log.length; i++) {
        const index = parseInt(log[i].match(/\d+/)![0], 10)
        assert.ok(index === prevIndex || index === prevIndex - 1)
        prevIndex = index
        // console.log(index)
      }
    })

    type FuncParams = {
      name: string
      startTime: number
      runTime: number | null
      abortTime: number | null
      abortController: IAbortControllerFast | null
      order: number
      readyToRunTime: number | null
    }

    function createFunc(
      name: string,
      results: string[],
      delayTime: number | null,
      timeController: ITimeController,
      timeStart: number,
    ) {
      return function func(abortSignal?: null | IAbortSignalFast) {
        results.push(`${timeController.now() - timeStart}-2: ${name} start`)
        if (delayTime != null) {
          return delay(delayTime, abortSignal, timeController).then(
            function delayThen() {
              results.push(`${timeController.now() - timeStart}-3: ${name} end`)
              return name
            },
          )
        }
        results.push(`${timeController.now() - timeStart}-3: ${name} end`)
        return name
      }
    }

    function enqueueFunc(
      results: string[],
      funcParams: FuncParams,
      timeController: ITimeController,
      timeStart: number,
      priorityQueue: PriorityQueue,
    ) {
      const func = createFunc(
        funcParams.name,
        results,
        funcParams.runTime,
        timeController,
        timeStart,
      )

      function enqueue() {
        results.push(
          `${timeController.now() - timeStart}-1: ${funcParams.name} enqueue`,
        )

        let promise: Promise<string>
        if (funcParams.readyToRunTime != null) {
          const task = priorityQueue.runTask(
            func,
            priorityCreate(funcParams.order),
            funcParams.abortController?.signal,
          )
          promise = task.result
          timeController.setTimeout(() => {
            task.setReadyToRun(true)
          }, funcParams.readyToRunTime)
        } else {
          promise = priorityQueue.run(
            func,
            priorityCreate(funcParams.order),
            funcParams.abortController?.signal,
          )
        }

        assert.ok(typeof promise.then === 'function')
        promise.then(
          function runThen(result) {
            results.push(
              `${timeController.now() - timeStart}-3: ${funcParams.name} result: ${result}`,
            )
          },
          function runError(err) {
            if (typeof err !== 'string') {
              results.push('ERROR: ' + err.stack)
            } else {
              results.push(
                `${timeController.now() - timeStart}-3: ${funcParams.name} aborted: ${err}`,
              )
            }
          },
        )
      }

      if (funcParams.abortTime != null) {
        timeController.setTimeout(function abortTimerCallback() {
          funcParams.abortController!.abort(funcParams.name)
        }, funcParams.startTime + funcParams.abortTime)
      }
      timeController.setTimeout(enqueue, funcParams.startTime)
    }

    function awaitTime(
      timeController: TimeControllerMock,
      time: number,
      awaitsPerTime: number,
    ) {
      let i = 0
      let j = 0
      function next() {
        if (j >= awaitsPerTime) {
          i++
          if (i >= time) {
            return
          }
          timeController.addTime(1)
          j = 0
        }
        timeController.addTime(0)
        j++
        return Promise.resolve().then(next)
      }
      return next()
      // for (let i = 0; i < time; i++) {
      //   for (let j = 0; j < awaitsPerTime; j++) {
      //     // eslint-disable-next-line @typescript-eslint/await-thenable
      //     timeController.addTime(0)
      //     await 0
      //   }
      //   timeController.addTime(1)
      // }
    }

    function getExpectedResults(funcsParams: FuncParams[]) {
      const len = funcsParams.length

      type State = null | 'enqueued' | 'started' | 'aborted' | 'completed'

      const resultsExpected: string[] = []

      const state: State[] = []
      for (let i = 0; i < len; i++) {
        state[i] = null
      }

      let time = 0
      let index = 0
      let startedFuncParamsIndex: number | null = null
      let startedFuncParamsEndTime: number | null = null
      let startedFuncParamsAbortTime: number | null = null
      let startedFuncParams: FuncParams | null = null

      while (time < 10) {
        for (let i = 0; i < len; i++) {
          const funcParams = funcsParams[i]
          if (state[i] === null) {
            if (time === funcParams.startTime) {
              state[i] = 'enqueued'
              resultsExpected[index++] =
                `${funcParams.startTime}-1: ${funcParams.name} enqueue`
            }
          }
        }

        for (let i = 0; i < len; i++) {
          const funcParams = funcsParams[i]
          if (state[i] === 'started' || state[i] === 'enqueued') {
            if (
              funcParams.abortTime != null &&
              time === funcParams.startTime + funcParams.abortTime
            ) {
              state[i] = 'aborted'
              resultsExpected[index++] =
                `${time}-3: ${funcParams.name} aborted: ${funcParams.name}`
              if (startedFuncParams === funcParams) {
                startedFuncParams = null
                startedFuncParamsIndex = null
              }
            }
          }
        }

        if (startedFuncParams && time === startedFuncParamsEndTime) {
          state[startedFuncParamsIndex!] = 'completed'
          resultsExpected[index++] = `${time}-3: ${startedFuncParams.name} end`
          resultsExpected[index++] =
            `${time}-3: ${startedFuncParams.name} result: ${startedFuncParams.name}`
          startedFuncParams = null
          startedFuncParamsIndex = null
        }

        if (!startedFuncParams) {
          for (let i = 0; i < len; i++) {
            if (state[i] === 'enqueued') {
              const funcParams = funcsParams[i]
              if (
                time >=
                  funcParams.startTime + (funcParams.readyToRunTime ?? 0) &&
                (!startedFuncParams ||
                  funcParams.order < startedFuncParams.order ||
                  (funcParams.order === startedFuncParams.order &&
                    funcParams.startTime < startedFuncParams.startTime))
              ) {
                startedFuncParamsIndex = i
                startedFuncParams = funcParams
              }
            }
          }
          if (startedFuncParams) {
            startedFuncParamsAbortTime =
              startedFuncParams.abortTime == null
                ? null
                : startedFuncParams.startTime + startedFuncParams.abortTime
            state[startedFuncParamsIndex!] = 'started'
            if (time !== startedFuncParamsAbortTime) {
              resultsExpected[index++] =
                `${time}-2: ${startedFuncParams.name} start`
              startedFuncParamsEndTime = time + (startedFuncParams.runTime || 0)
            }
          } else {
            time++
          }
        } else {
          time++
        }
      }

      return resultsExpected
    }

    function compare(o1, o2) {
      if (o1 < o2) {
        return -1
      }
      if (o1 > o2) {
        return 1
      }
      return 0
    }

    const testVariants = createTestVariants(async function testVariant({
      readyToRunTime1,
      readyToRunTime2,
      readyToRunTime3,

      abortTime1,
      abortTime2,
      abortTime3,

      order1,
      order2,
      order3,

      runTime1,
      runTime2,
      runTime3,

      startTime1,
      startTime2,
      startTime3,
    }: {
      readyToRunTime1: number | null
      readyToRunTime2: number | null
      readyToRunTime3: number | null

      abortTime1: number | null
      abortTime2: number | null
      abortTime3: number | null

      order1: number
      order2: number
      order3: number

      runTime1: number | null
      runTime2: number | null
      runTime3: number | null

      startTime1: number
      startTime2: number
      startTime3: number
    }) {
      const results = []
      const timeController = new TimeControllerMock()
      const priorityQueue = new PriorityQueue()
      const funcsParams: FuncParams[] = [
        {
          name: 'func1',
          startTime: startTime1,
          runTime: runTime1,
          abortTime: abortTime1,
          abortController:
            abortTime1 == null ? null : new AbortControllerFast(),
          order: order1,
          readyToRunTime: readyToRunTime1,
        },
        {
          name: 'func2',
          startTime: startTime2,
          runTime: runTime2,
          abortTime: abortTime2,
          abortController:
            abortTime2 == null ? null : new AbortControllerFast(),
          order: order2,
          readyToRunTime: readyToRunTime2,
        },
        {
          name: 'func3',
          startTime: startTime3,
          runTime: runTime3,
          abortTime: abortTime3,
          abortController:
            abortTime3 == null ? null : new AbortControllerFast(),
          order: order3,
          readyToRunTime: readyToRunTime3,
        },
      ]
      const len = funcsParams.length

      const timeStart = timeController.now()

      for (let i = 0; i < len; i++) {
        const funcParams = funcsParams[i]
        enqueueFunc(
          results,
          funcParams,
          timeController,
          timeStart,
          priorityQueue,
        )
      }

      assert.strictEqual(results.length, 0)

      await awaitTime(timeController, 9, 15)

      const expectedResults = getExpectedResults(funcsParams)

      assert.deepStrictEqual(
        results.sort(compare),
        expectedResults.sort(compare),
      )

      results.length = 0
      timeController.addTime(1000000)
      await awaitTime(timeController, 1, 20)
      assert.strictEqual(results.length, 0)
    })

    it.skip('custom 1', { timeout: 300_000 }, async () => {
      await testVariants({
        readyToRunTime1: [0],
        readyToRunTime2: [0],
        readyToRunTime3: [0],
        abortTime1: [null],
        abortTime2: [null],
        abortTime3: [null],
        order1: [0],
        order2: [0],
        order3: [0],
        runTime1: [2],
        runTime2: [2],
        runTime3: [2],
        startTime1: [2],
        startTime2: [2],
        startTime3: [2],
      })()
    })

    it.skip('custom 2', { timeout: 300_000 }, async () => {
      await testVariants({
        readyToRunTime1: [0],
        readyToRunTime2: [0],
        readyToRunTime3: [0],
        abortTime1: [null],
        abortTime2: [null],
        abortTime3: [0],
        order1: [0],
        order2: [0],
        order3: [0],
        runTime1: [null],
        runTime2: [1],
        runTime3: [null],
        startTime1: [0],
        startTime2: [0],
        startTime3: [1],
      })()
    })

    it.skip('custom 3', { timeout: 300_000 }, async () => {
      await testVariants({
        readyToRunTime1: [0],
        readyToRunTime2: [0],
        readyToRunTime3: [0],
        abortTime1: [null],
        abortTime2: [null],
        abortTime3: [0],
        order1: [0],
        order2: [0],
        order3: [0],
        runTime1: [null],
        runTime2: [null],
        runTime3: [null],
        startTime1: [0],
        startTime2: [0],
        startTime3: [0],
      })()
    })

    it.skip('profiling', { timeout: 300_000 }, async () => {
      await testVariants({
        readyToRunTime1: [0],
        readyToRunTime2: [0],
        readyToRunTime3: [0],

        abortTime1: [0, 1],
        abortTime2: [0, 1],
        abortTime3: [0, 2],

        order1: [0, 1, 2],
        order2: [0, 1, 2],
        order3: [0, 1, 2],

        runTime1: [null, 1, 2],
        runTime2: [null, 1, 2],
        runTime3: [null, 1, 2],

        startTime1: [0, 1, 2],
        startTime2: [0, 1, 2],
        startTime3: [0, 1, 2],
      })()
    })

    it('variants', { timeout: 20 * 60 * 1000 }, async () => {
      const isBrowser = typeof window !== 'undefined'

      await testVariants({
        readyToRunTime1: isBrowser ? [null, 1] : [null, 0, 1, 2],
        readyToRunTime2: [null],
        readyToRunTime3: [null],

        abortTime1: isBrowser ? [null, 2] : [null, 0, 1, 2],
        abortTime2: isBrowser ? [null, 0] : [null, 0, 1, 2],
        abortTime3: [null],

        order1: [0, 1, 2],
        order2: [0, 1, 2],
        order3: [0, 1, 2],

        runTime1: [null, 1, 2],
        runTime2: [null, 1, 2],
        runTime3: [null, 1, 2],

        startTime1: isBrowser ? [1, 2] : [0, 1, 2],
        startTime2: isBrowser ? [0, 2] : [0, 1, 2],
        startTime3: isBrowser ? [0, 1] : [0, 1, 2],
      })()
    })
  },
)

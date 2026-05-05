/**
 * Logging: disabled by default, enabled only on error (test re-runs with log: true)
 *
 * General format:
 * - Log entries: bracket-path style with [test] prefix
 *
 * Actions:
 * - START - before task.run() with run options and expected start time
 * - END - after task.run() with actual start and end times
 *
 * Parameters:
 * - [i] - iteration index
 * - throttleTime, throttleTimeMax, throttleFromEnd, immediate - run options for this call
 * - throttleTimeEffective - computed effective throttle time after defaults and max cap
 * - expectedStart - expected execution start time
 * - actualStart, actualEnd - actual execution timestamps
 * - result - return value from task.run()
 *
 * Example trace:
 * [test][run][0] START throttleTime=null throttleTimeMax=null throttleFromEnd=null immediate=null throttleTimeEffective=5 expectedStart=0
 * [test][run][0] END actualStart=0 actualEnd=3 result=0
 * [test][run][1] START throttleTime=8 throttleTimeMax=null throttleFromEnd=true immediate=null throttleTimeEffective=8 expectedStart=11
 * [test][run][1] END actualStart=11 actualEnd=14 result=1
 */
import { describe, it } from 'vitest'
import { createTestVariants } from '@flemist/test-variants'
import { TimeControllerMock } from '@flemist/time-controller'
import { waitTimeControllerMock } from '@flemist/async-utils'
import { getRandomSeed, Random, randomItem } from 'src/common/random'
import { createTaskThrottled } from './TaskThrottled'

export type TestVariantsArgs = {
  seed: number
  throttleTimeDefault: number | null
  throttleTimeMax: number | null
  throttleFromEnd: boolean
  executionDuration: number
  runThrottleTimeValues: (number | null)[]
  runThrottleTimeMaxValues: (number | null)[]
  runThrottleFromEndValues: (boolean | null)[]
  runImmediateValues: (boolean | null)[]
}

const testVariants = createTestVariants(async (args: TestVariantsArgs) => {
  const rnd = new Random(args.seed)
  try {
    const context = await generateContext({ args, log: false })
    await test({ rnd: rnd.clone(), context, args })
  } catch (err) {
    try {
      const context = await generateContext({ args, log: true })
      await test({ rnd: rnd.clone(), context, args })
    } catch {
      // ignore re-run error, throw original
    }
    throw err
  }
})

type TestContext = {
  log: boolean
  timeController: TimeControllerMock
  task: ReturnType<typeof createTaskThrottled>
  originTime: number
  timeStamps: { start: number; end: number }[]
}

type GenerateContextOptions = {
  args: TestVariantsArgs
  log: boolean
}

async function generateContext(
  options: GenerateContextOptions,
): Promise<TestContext> {
  const { args, log } = options
  const timeController = new TimeControllerMock()
  const originTime = timeController.now()
  const timeStamps: { start: number; end: number }[] = []

  let callCount = 0
  const task = createTaskThrottled(
    async () => {
      const funcStart = timeController.now() - originTime
      timeController.addTime(args.executionDuration)
      timeStamps.push({
        start: funcStart,
        end: timeController.now() - originTime,
      })
      return callCount++
    },
    null,
    {
      throttleTimeDefault: args.throttleTimeDefault,
      throttleTimeMax: args.throttleTimeMax,
      throttleFromEnd: args.throttleFromEnd,
      timeController,
    },
  )

  return { log, timeController, task, originTime, timeStamps }
}

type TestOptions = {
  rnd: Random
  context: TestContext
  args: TestVariantsArgs
}

async function test(options: TestOptions): Promise<void> {
  const { rnd, context, args } = options
  const { timeController, task, timeStamps, log } = context

  let throttleFromEndState = args.throttleFromEnd

  for (let i = 0; i < 100; i++) {
    const runThrottleTime = randomItem(rnd, args.runThrottleTimeValues)
    const runThrottleTimeMax = randomItem(rnd, args.runThrottleTimeMaxValues)
    const runThrottleFromEnd = randomItem(rnd, args.runThrottleFromEndValues)
    const runImmediate = randomItem(rnd, args.runImmediateValues)

    const throttleTimeEffectiveRaw = runImmediate
      ? 0
      : (runThrottleTime ?? args.throttleTimeDefault ?? 0)
    const throttleTimeMaxEffective =
      runThrottleTimeMax == null ? args.throttleTimeMax : runThrottleTimeMax
    const throttleTimeEffective =
      throttleTimeMaxEffective == null
        ? throttleTimeEffectiveRaw
        : Math.min(throttleTimeEffectiveRaw, throttleTimeMaxEffective)

    let expectedStart: number
    if (i === 0) {
      expectedStart = 0
    } else {
      const prevTimeStamp = timeStamps[i - 1]
      const lastCallTime = throttleFromEndState
        ? prevTimeStamp.end
        : prevTimeStamp.start
      expectedStart = throttleFromEndState
        ? lastCallTime + throttleTimeEffective
        : Math.max(lastCallTime + throttleTimeEffective, prevTimeStamp.end)
    }

    if (runThrottleFromEnd != null) {
      throttleFromEndState = runThrottleFromEnd
    }

    if (log) {
      console.log(
        `[test][run][${i}] START throttleTime=${runThrottleTime} throttleTimeMax=${runThrottleTimeMax} throttleFromEnd=${runThrottleFromEnd} immediate=${runImmediate} throttleTimeEffective=${throttleTimeEffective} expectedStart=${expectedStart}`,
      )
    }

    const result = await waitTimeControllerMock(
      timeController,
      Promise.resolve(
        task.run({
          throttleTime: runThrottleTime,
          throttleTimeMax: runThrottleTimeMax,
          throttleFromEnd: runThrottleFromEnd,
          immediate: runImmediate,
        }),
      ),
      { awaitsPerIteration: 1 },
    )

    if (log) {
      console.log(
        `[test][run][${i}] END actualStart=${timeStamps[i].start} actualEnd=${timeStamps[i].end} result=${result}`,
      )
    }

    if (result !== i) {
      throw new Error(`[${i}] result: expected ${i}, actual ${result}`)
    }
    if (timeStamps[i].start !== expectedStart) {
      throw new Error(
        `[${i}] start: expected ${expectedStart}, actual ${timeStamps[i].start}`,
      )
    }
    if (timeStamps[i].end !== expectedStart + args.executionDuration) {
      throw new Error(
        `[${i}] end: expected ${expectedStart + args.executionDuration}, actual ${timeStamps[i].end}`,
      )
    }
  }
}

describe('toThrottled', { timeout: 7 * 60 * 60 * 1000 }, () => {
  it('variants', async () => {
    await testVariants({
      throttleTimeDefault: Array.from({ length: 11 }, (_, i) =>
        i === 0 ? null : i - 1,
      ),
      throttleTimeMax: Array.from({ length: 11 }, (_, i) =>
        i === 0 ? null : i - 1,
      ),
      throttleFromEnd: [false, true],
      executionDuration: Array.from({ length: 6 }, (_, i) => i),
      runThrottleTimeValues: [
        Array.from({ length: 11 }, (_, i) => (i === 0 ? null : i - 1)),
      ],
      runThrottleTimeMaxValues: [
        Array.from({ length: 11 }, (_, i) => (i === 0 ? null : i - 1)),
      ],
      runThrottleFromEndValues: [[null, false, true]],
      runImmediateValues: [[null, false, true]],
    })({
      limitTime: 2 * 60 * 60 * 1000,
      parallel: 1,
      cycles: 1e9,
      getSeed: () => getRandomSeed(),
      findBestError: {
        limitArgOnError: true,
      },
      iterationModes: [
        {
          mode: 'forward',
          limitTests: 10,
        },
        {
          mode: 'random',
          limitTests: 100,
        },
        {
          mode: 'backward',
          limitTests: 10,
        },
      ],
      saveErrorVariants: {
        dir: 'tmp/test/toThrottled/variants',
        attemptsPerVariant: 10,
        useToFindBestError: false,
      },
    })
  })
})

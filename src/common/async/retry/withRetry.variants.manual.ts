/**
 * Logging: disabled by default, enabled only on error (test re-runs with log: true)
 *
 * General format:
 * - Log entries: bracket-path style with [test] prefix
 *
 * Entity naming:
 * - func-N - Nth invocation of the retry function (0-indexed)
 *
 * Actions:
 * - CALL - func invoked, shows index and whether it throws
 * - RESOLVED - withRetry resolved successfully with result
 * - REJECTED - withRetry rejected with error
 * - ABORT - abortSignal fired during execution
 *
 * Parameters:
 * - callIndex - 0-based index of func invocation
 * - error - whether func threw
 * - result - value returned by func
 * - totalCalls - total number of func invocations
 * - maxRetries - configured maxRetries limit
 * - maxTotalTime - configured maxTotalTime limit
 * - delaysMode - "array" or "exponential"
 *
 * Example trace:
 * [test] config maxRetries=3 maxTotalTime=null delaysMode=array delays=[10,20,40]
 * [test][call][0] error=true
 * [test][call][1] error=true
 * [test][call][2] error=false result=2
 * [test] RESOLVED result=2 totalCalls=3
 */
import { describe, it } from 'vitest'
import { createTestVariants } from '@flemist/test-variants'
import { TimeControllerMock } from '@flemist/time-controller'
import { AbortControllerFast } from '@flemist/abort-controller-fast'
import { waitTimeControllerMock } from 'src/common/async/wait/waitTimeControllerMock'
import {
  getRandomSeed,
  Random,
  randomInt,
  randomBoolean,
} from 'src/common/random'
import { LogLevel } from 'src/common/debug'
import { withRetry, createTaskDelayRetry } from './withRetry'

export type TestVariantsArgs = {
  seed: number
  maxRetriesMax: number
  maxTotalTimeMax: number
  delaysMode: 'array' | 'exponential' | null
  failCountMax: number
  useAbort: boolean
  useJitter: boolean
}

const testVariants = createTestVariants(async (args: TestVariantsArgs) => {
  const rnd = new Random(args.seed)
  try {
    await test({ rnd: rnd.clone(), args, log: false })
  } catch (err) {
    try {
      await test({ rnd: rnd.clone(), args, log: true })
    } catch {
      // ignore re-run error, throw original
    }
    throw err
  }
})

type DelaysConfig =
  | { mode: 'array'; values: number[] }
  | { mode: 'exponential'; min: number; max: number; mult: number }

type GeneratedPlan = {
  failCount: number
  maxRetries: number | null
  maxTotalTime: number | null
  delays: DelaysConfig
  jitter: number | null
  abortAfterCall: number | null
}

type TestOptions = {
  rnd: Random
  args: TestVariantsArgs
  log: boolean
}

function generatePlan(options: {
  rnd: Random
  args: TestVariantsArgs
}): GeneratedPlan {
  const { rnd, args } = options

  const failCount = randomInt(rnd, 0, args.failCountMax + 1)

  const maxRetries =
    args.maxRetriesMax > 0 ? randomInt(rnd, 0, args.maxRetriesMax + 1) : null

  const maxTotalTime =
    args.maxTotalTimeMax > 0
      ? randomInt(rnd, 1, args.maxTotalTimeMax + 1)
      : null

  let delaysMode: 'array' | 'exponential'
  if (args.delaysMode != null) {
    delaysMode = args.delaysMode
  } else {
    delaysMode = randomBoolean(rnd) ? 'array' : 'exponential'
  }

  let delays: DelaysConfig
  if (delaysMode === 'array') {
    const len = randomInt(rnd, 1, 5)
    const values: number[] = []
    for (let i = 0; i < len; i++) {
      values.push(randomInt(rnd, 1, 50))
    }
    delays = { mode: 'array', values }
  } else {
    const min = randomInt(rnd, 1, 20)
    const max = randomInt(rnd, min * 2, min * 10 + 1)
    const mult = randomInt(rnd, 2, 4)
    delays = { mode: 'exponential', min, max, mult }
  }

  const jitter = args.useJitter ? 1 + randomInt(rnd, 1, 4) * 0.5 : null

  const abortAfterCall =
    args.useAbort && failCount > 0 ? randomInt(rnd, 0, failCount) : null

  return { failCount, maxRetries, maxTotalTime, delays, jitter, abortAfterCall }
}

function getExpectedDelay(plan: GeneratedPlan, retryIndex: number): number {
  if (plan.delays.mode === 'array') {
    const values = plan.delays.values
    return values[Math.min(retryIndex, values.length - 1)]
  }
  const { min, max, mult } = plan.delays
  return Math.min(min * mult ** retryIndex, max)
}

async function test(options: TestOptions): Promise<void> {
  const { rnd, args, log } = options
  const plan = generatePlan({ rnd: rnd.clone(), args })

  const timeController = new TimeControllerMock()
  const abortController = args.useAbort ? new AbortControllerFast() : null

  const callRecords: {
    index: number
    threw: boolean
    result?: number
    time: number
  }[] = []
  let callIndex = 0

  if (log) {
    const delaysStr =
      plan.delays.mode === 'array'
        ? `[${plan.delays.values.join(',')}]`
        : `exp(min=${plan.delays.min},max=${plan.delays.max},mult=${plan.delays.mult})`
    console.log(
      `[test] config maxRetries=${plan.maxRetries} maxTotalTime=${plan.maxTotalTime}` +
        ` delaysMode=${plan.delays.mode} delays=${delaysStr}` +
        ` jitter=${plan.jitter} failCount=${plan.failCount} abortAfterCall=${plan.abortAfterCall}`,
    )
  }

  const delayOption = createTaskDelayRetry({
    maxRetries: plan.maxRetries,
    maxTotalTime: plan.maxTotalTime,
    delays:
      plan.delays.mode === 'array'
        ? plan.delays.values
        : {
            min: plan.delays.min,
            max: plan.delays.max,
            mult: plan.delays.mult,
          },
    jitter: plan.jitter,
  })

  const retryPromise = withRetry({
    func: ({ abortSignal }) => {
      const i = callIndex++
      const shouldThrow = i < plan.failCount

      if (plan.abortAfterCall != null && i === plan.abortAfterCall) {
        abortController!.abort()
      }

      const record = {
        index: i,
        threw: shouldThrow,
        result: shouldThrow ? undefined : i,
        time: timeController.now(),
      }
      callRecords.push(record)

      if (log) {
        console.log(
          `[test][call][${i}] error=${shouldThrow}${shouldThrow ? '' : ` result=${i}`}`,
        )
      }

      if (shouldThrow) {
        throw new Error(`func error ${i}`)
      }
      return i
    },
    delay: delayOption,
    abortSignal: abortController?.signal ?? null,
    timeController,
    logLevel: LogLevel.none,
  })

  const maxDelayPerRetry =
    plan.delays.mode === 'array'
      ? Math.max(...plan.delays.values)
      : plan.delays.max
  const maxCalls =
    plan.maxRetries != null
      ? Math.min(plan.failCount + 1, plan.maxRetries + 1)
      : plan.failCount + 1
  const maxTime = Math.max(
    (maxCalls + 1) * (maxDelayPerRetry * (plan.jitter ?? 1) + 10),
    (plan.maxTotalTime ?? 0) + maxDelayPerRetry * (plan.jitter ?? 1) + 10,
  )

  let resolved = false
  let rejected = false
  let resolvedValue: number | undefined
  let rejectedError: any

  try {
    resolvedValue = await waitTimeControllerMock(timeController, retryPromise, {
      timeout: maxTime,
    })
    resolved = true
  } catch (err) {
    rejected = true
    rejectedError = err
  }

  if (log) {
    if (resolved) {
      console.log(
        `[test] RESOLVED result=${resolvedValue} totalCalls=${callRecords.length}`,
      )
    } else if (rejected) {
      console.log(
        `[test] REJECTED error=${rejectedError?.message} totalCalls=${callRecords.length}`,
      )
    }
  }

  checkResult(
    plan,
    callRecords,
    resolved,
    rejected,
    resolvedValue,
    rejectedError,
  )
  checkCallCount(plan, callRecords)
  if (!args.useAbort && plan.jitter == null) {
    checkDelayTiming(plan, callRecords)
  }
}

function checkResult(
  plan: GeneratedPlan,
  callRecords: {
    index: number
    threw: boolean
    result?: number
    time: number
  }[],
  resolved: boolean,
  rejected: boolean,
  resolvedValue: number | undefined,
  rejectedError: any,
): void {
  if (plan.abortAfterCall != null && plan.abortAfterCall < plan.failCount) {
    if (!rejected) {
      throw new Error(
        `expected rejection due to abort after call ${plan.abortAfterCall}, but got resolved=${resolved}`,
      )
    }
    return
  }

  const wouldSucceedAtCall = plan.failCount

  if (plan.maxTotalTime != null) {
    if (rejected) {
      return
    }
    if (resolved) {
      if (resolvedValue !== wouldSucceedAtCall) {
        throw new Error(
          `expected result=${wouldSucceedAtCall}, actual=${resolvedValue}`,
        )
      }
      return
    }
  }

  if (plan.maxRetries != null && wouldSucceedAtCall > plan.maxRetries) {
    if (!rejected) {
      throw new Error(
        `expected rejection due to maxRetries=${plan.maxRetries}` +
          ` (need ${wouldSucceedAtCall} retries to succeed), but got resolved=${resolved}`,
      )
    }
    return
  }

  if (!resolved) {
    throw new Error(
      `expected resolution with result=${wouldSucceedAtCall}` +
        ` but got resolved=${resolved} rejected=${rejected}` +
        ` error=${rejectedError?.message}`,
    )
  }

  if (resolvedValue !== wouldSucceedAtCall) {
    throw new Error(
      `expected result=${wouldSucceedAtCall}, actual=${resolvedValue}`,
    )
  }
}

function checkCallCount(
  plan: GeneratedPlan,
  callRecords: {
    index: number
    threw: boolean
    result?: number
    time: number
  }[],
): void {
  if (plan.abortAfterCall != null && plan.abortAfterCall < plan.failCount) {
    if (callRecords.length > plan.abortAfterCall + 1) {
      throw new Error(
        `abort after call ${plan.abortAfterCall}: expected at most ${plan.abortAfterCall + 1} calls` +
          `, actual ${callRecords.length}`,
      )
    }
    return
  }

  const wouldSucceedAtCall = plan.failCount
  const maxCallsByRetries =
    plan.maxRetries != null ? plan.maxRetries + 1 : Infinity

  if (plan.maxTotalTime != null) {
    if (
      callRecords.length > Math.min(wouldSucceedAtCall + 1, maxCallsByRetries)
    ) {
      throw new Error(
        `expected at most ${Math.min(wouldSucceedAtCall + 1, maxCallsByRetries)} calls` +
          `, actual ${callRecords.length}`,
      )
    }
    return
  }

  if (maxCallsByRetries < wouldSucceedAtCall + 1) {
    if (callRecords.length !== maxCallsByRetries) {
      throw new Error(
        `maxRetries=${plan.maxRetries}: expected ${maxCallsByRetries} calls` +
          `, actual ${callRecords.length}`,
      )
    }
    return
  }

  const expectedCalls = wouldSucceedAtCall + 1
  if (callRecords.length !== expectedCalls) {
    throw new Error(
      `expected ${expectedCalls} calls (${wouldSucceedAtCall} failures + 1 success)` +
        `, actual ${callRecords.length}`,
    )
  }
}

function checkDelayTiming(
  plan: GeneratedPlan,
  callRecords: {
    index: number
    threw: boolean
    result?: number
    time: number
  }[],
): void {
  if (callRecords.length <= 1) {
    return
  }

  for (let i = 1; i < callRecords.length; i++) {
    const actualDelay = callRecords[i].time - callRecords[i - 1].time
    const expectedDelay = getExpectedDelay(plan, i - 1)

    if (actualDelay < expectedDelay) {
      throw new Error(
        `delay between call ${i - 1} and ${i}: expected >= ${expectedDelay}` +
          `, actual ${actualDelay}`,
      )
    }
  }
}

describe('withRetry', { timeout: 7 * 60 * 60 * 1000 }, () => {
  it('variants', async () => {
    await testVariants({
      maxRetriesMax: Array.from({ length: 11 }, (_, i) => i),
      maxTotalTimeMax: Array.from({ length: 500 }, (_, i) => i),
      delaysMode: [null, 'array', 'exponential'],
      failCountMax: Array.from({ length: 11 }, (_, i) => i),
      useAbort: [false, true],
      useJitter: [false, true],
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
          limitTests: 100,
        },
        {
          mode: 'random',
          limitTests: 10000,
        },
        {
          mode: 'backward',
          limitTests: 100,
        },
      ],
      saveErrorVariants: {
        dir: 'tmp/test/withRetry/variants',
        attemptsPerVariant: 10,
        useToFindBestError: false,
      },
      timeout: 2000,
    })
  })
})

/**
 * Logging: disabled by default, enabled only on error (test re-runs with log: true)
 *
 * General format:
 * - Log entries: bracket-path style with [test] prefix
 *
 * Actions:
 * - DELAY - delay function called with current status, shows returned decision
 * - EXEC - task function executed, shows start/end times and result
 * - DONE - process loop completed, all timers drained
 *
 * Parameters:
 * - [i] - delay call index or exec index
 * - delayMs - numeric delay value returned
 * - stop - delay requested loop stop
 * - skipRun - delay requested skip execution
 * - funcDelay - whether delay is a function (vs numeric)
 * - error - whether task function threw
 * - actualStart, actualEnd - execution timestamps relative to origin
 * - result - return value from task function
 * - lastEnd - status.lastEnd relative to origin at time delay was called
 * - lastHasError - status.lastHasError at time delay was called
 * - lastFailedRuns - status.lastFailedRuns at time delay was called
 * - lastFailedReason - status.lastFailedReason at time delay was called
 * - skipRepeatAt - iteration index where skipRepeat is called (null = never)
 * - customSuccessPredicate - whether custom successPredicate is used
 *
 * Example trace:
 * [test][delay][0] lastEnd=null lastHasError=false lastFailedRuns=null → delayMs=5 stop=false skipRun=false funcDelay=false
 * [test][exec][0] actualStart=0 actualEnd=3 result=0 error=false
 * [test][delay][1] lastEnd=3 lastHasError=false lastFailedRuns=0 → delayMs=5 stop=false skipRun=false funcDelay=true
 * [test][exec][1] actualStart=8 actualEnd=11 result=1 error=true
 * [test][delay][2] lastEnd=11 lastHasError=true lastFailedRuns=1 → delayMs=null stop=true skipRun=false funcDelay=false
 * [test] DONE executions=2
 */
import { describe, it } from 'vitest'
import { createTestVariants } from '@flemist/test-variants'
import { TimeControllerMock } from '@flemist/time-controller'
import {
  TASK_STOP,
  type SuccessPredicateResult,
  type TaskDelay,
  type TaskStatusBase,
} from './types'
import { LogLevel } from 'src/common/debug'
import { waitTimeControllerMock } from 'src/common/async/wait/waitTimeControllerMock'
import { getRandomSeed, Random, randomInt } from 'src/common/random'
import { createTaskRepeated, type ITaskRepeated } from './TaskRepeated'

export type TestVariantsArgs = {
  seed: number
  executionDuration: number
  iterationsMax: number
  delayTimeMax: number
  skipRunProbabilityPercent: number
  errorProbabilityPercent: number
  funcDelayProbabilityPercent: number
  useImmediate: boolean
  skipRepeatProbabilityPercent: number
  useCustomSuccessPredicate: boolean
}

const testVariants = createTestVariants(async (args: TestVariantsArgs) => {
  const rnd = new Random(args.seed)
  try {
    const context = await generateContext({
      rnd: rnd.clone(),
      args,
      log: false,
    })
    await test({ rnd: rnd.clone(), context, args })
  } catch (err) {
    try {
      const context = await generateContext({
        rnd: rnd.clone(),
        args,
        log: true,
      })
      await test({ rnd: rnd.clone(), context, args })
    } catch {
      // ignore re-run error, throw original
    }
    throw err
  }
})

type DelayCallRecord = {
  index: number
  statusLastEnd: number | null
  statusLastHasError: boolean
  statusIsRunning: boolean
  statusLastFailedRuns: number | null | undefined
  statusLastFailedReason: any
  result: TaskDelay<number>
}

type ExecRecord = {
  start: number
  end: number
  result: number
  threw: boolean
}

type GeneratedDelayPlan = {
  iterations: number
  delays: number[]
  skipRunIndices: Set<number>
  funcDelayIndices: Set<number>
  errorExecIndices: Set<number>
  skipRepeatAtIteration: number | null
}

type TestContext = {
  log: boolean
  timeController: TimeControllerMock
  task: ITaskRepeated<null, number>
  originTime: number
  execRecords: ExecRecord[]
  delayCallRecords: DelayCallRecord[]
  plan: GeneratedDelayPlan
  useImmediate: boolean
}

type GenerateContextOptions = {
  rnd: Random
  args: TestVariantsArgs
  log: boolean
}

function generateDelayPlan(options: {
  rnd: Random
  args: TestVariantsArgs
}): GeneratedDelayPlan {
  const { rnd, args } = options
  const iterations = randomInt(rnd, 0, args.iterationsMax + 1)
  const delays: number[] = []
  const skipRunIndices = new Set<number>()
  const funcDelayIndices = new Set<number>()

  for (let i = 0; i < iterations; i++) {
    delays.push(randomInt(rnd, 0, args.delayTimeMax + 1))
    if (
      args.skipRunProbabilityPercent > 0 &&
      randomInt(rnd, 0, 100) < args.skipRunProbabilityPercent
    ) {
      skipRunIndices.add(i)
    }
    if (
      args.funcDelayProbabilityPercent > 0 &&
      randomInt(rnd, 0, 100) < args.funcDelayProbabilityPercent
    ) {
      funcDelayIndices.add(i)
    }
  }

  // Determine which executions will throw
  const execCount = iterations - skipRunIndices.size
  const errorExecIndices = new Set<number>()
  for (let i = 0; i < execCount; i++) {
    if (
      args.errorProbabilityPercent > 0 &&
      randomInt(rnd, 0, 100) < args.errorProbabilityPercent
    ) {
      errorExecIndices.add(i)
    }
  }

  let skipRepeatAtIteration: number | null = null
  if (
    args.skipRepeatProbabilityPercent > 0 &&
    iterations > 0 &&
    randomInt(rnd, 0, 100) < args.skipRepeatProbabilityPercent
  ) {
    skipRepeatAtIteration = randomInt(rnd, 0, iterations)
  }

  return {
    iterations,
    delays,
    skipRunIndices,
    funcDelayIndices,
    errorExecIndices,
    skipRepeatAtIteration,
  }
}

async function generateContext(
  options: GenerateContextOptions,
): Promise<TestContext> {
  const { rnd, args, log } = options
  const timeController = new TimeControllerMock()
  const originTime = timeController.now()
  const execRecords: ExecRecord[] = []
  const delayCallRecords: DelayCallRecord[] = []

  const plan = generateDelayPlan({ rnd, args })

  let callCount = 0
  let delayIndex = 0

  const { repeated: task } = createTaskRepeated<null, number>(
    async () => {
      const funcStart = timeController.now() - originTime
      timeController.addTime(args.executionDuration)
      const funcEnd = timeController.now() - originTime
      const execIdx = callCount++
      const shouldThrow = plan.errorExecIndices.has(execIdx)
      execRecords.push({
        start: funcStart,
        end: funcEnd,
        result: execIdx,
        threw: shouldThrow,
      })
      if (log) {
        console.log(
          `[test][exec][${execIdx}] actualStart=${funcStart} actualEnd=${funcEnd} result=${execIdx} error=${shouldThrow}`,
        )
      }
      if (shouldThrow) {
        throw new Error(`exec error ${execIdx}`)
      }
      return execIdx
    },
    null,
    {
      timeController,
      logLevel: LogLevel.none,
      successPredicate: args.useCustomSuccessPredicate
        ? (status: TaskStatusBase<number>): true | SuccessPredicateResult => {
            if (status.lastEnd != null && !status.lastHasError) {
              return { success: true }
            }
            return {
              success: false,
              reason: { customReason: true, error: status.lastError },
            }
          }
        : null,
      delay(status: TaskStatusBase<number>): TaskDelay<number> {
        const i = delayIndex++
        const shouldStop = i >= plan.iterations

        if (plan.skipRepeatAtIteration === i) {
          task.skipRepeat()
        }

        const useFuncDelay = plan.funcDelayIndices.has(i)
        const delayResult: TaskDelay<number> = shouldStop
          ? TASK_STOP
          : {
              delay: useFuncDelay ? () => plan.delays[i] : plan.delays[i],
              skipRun: plan.skipRunIndices.has(i),
            }

        const record: DelayCallRecord = {
          index: i,
          statusLastEnd:
            status.lastEnd == null ? null : status.lastEnd - originTime,
          statusLastHasError: status.lastHasError,
          statusIsRunning: status.isRunning,
          statusLastFailedRuns: status.lastFailedRuns,
          statusLastFailedReason: status.lastFailedReason,
          result: delayResult,
        }
        delayCallRecords.push(record)

        if (log) {
          const isStop = delayResult === TASK_STOP
          console.log(
            `[test][delay][${i}] lastEnd=${record.statusLastEnd} lastHasError=${record.statusLastHasError} lastFailedRuns=${record.statusLastFailedRuns}` +
              ` lastFailedReason=${record.statusLastFailedReason === undefined ? 'undefined' : JSON.stringify(record.statusLastFailedReason)}` +
              ` → delayMs=${plan.delays[i] ?? null} stop=${isStop} skipRun=${!isStop && (delayResult.skipRun ?? false)} funcDelay=${useFuncDelay}` +
              ` skipRepeatHere=${plan.skipRepeatAtIteration === i}`,
          )
        }

        return delayResult
      },
    },
  )

  return {
    log,
    timeController,
    task,
    originTime,
    execRecords,
    delayCallRecords,
    plan,
    useImmediate: args.useImmediate,
  }
}

type TestOptions = {
  rnd: Random
  context: TestContext
  args: TestVariantsArgs
}

async function test(options: TestOptions): Promise<void> {
  const { context, args } = options
  const { timeController, task, execRecords, delayCallRecords, plan, log } =
    context

  if (context.useImmediate) {
    const runPromise = task.run().catch(() => {})

    task.run({ immediate: true })

    const maxTime =
      (plan.iterations + 1) * (args.executionDuration + args.delayTimeMax + 10)
    await waitTimeControllerMock(timeController, null, { timeout: maxTime })
    await runPromise

    if (log) {
      console.log(`[test] IMMEDIATE execCount=${execRecords.length}`)
    }

    if (plan.skipRepeatAtIteration == null) {
      const expectedExecCount = plan.iterations - plan.skipRunIndices.size
      if (execRecords.length < expectedExecCount) {
        throw new Error(
          `immediate: execCount expected >= ${expectedExecCount}, actual ${execRecords.length}`,
        )
      }
    }
    if (execRecords.length > 0 && execRecords[0].start !== 0) {
      throw new Error(
        `immediate: start expected 0, actual ${execRecords[0].start}`,
      )
    }
    return
  }

  if (plan.iterations === 0) {
    let resolved = false
    let rejected = false
    let result: any
    task.run().then(
      value => {
        resolved = true
        result = value
      },
      () => {
        rejected = true
      },
    )

    await waitTimeControllerMock(timeController, null, { timeout: 100 })

    if (log) {
      console.log(
        `[test] STOP-IMMEDIATELY resolved=${resolved} rejected=${rejected} result=${result}`,
      )
    }

    if (delayCallRecords.length !== 1) {
      throw new Error(
        `stop-immediately: expected 1 delay call, actual ${delayCallRecords.length}`,
      )
    }
    if (delayCallRecords[0].result !== TASK_STOP) {
      throw new Error(`stop-immediately: first delay should return TASK_STOP`)
    }
    if (execRecords.length !== 0) {
      throw new Error(
        `stop-immediately: expected 0 executions, actual ${execRecords.length}`,
      )
    }
    if (!rejected) {
      throw new Error(
        `stop-immediately: run() should reject (stopped before first execution), but resolved=${resolved} rejected=${rejected}`,
      )
    }
    return
  }

  const runPromise = task.run().catch(() => {})

  const maxTime =
    (plan.iterations + 1) * (args.executionDuration + args.delayTimeMax + 10)
  await waitTimeControllerMock(timeController, null, {
    timeout: maxTime,
  })
  await runPromise

  if (log) {
    console.log(`[test] DONE executions=${execRecords.length}`)
  }

  if (plan.skipRepeatAtIteration != null) {
    checkSkipRepeat(delayCallRecords, execRecords, plan)
  } else {
    checkDelayCallCount(delayCallRecords, plan)
    checkExecCount(execRecords, plan)
  }
  checkDelayCalledWhenIdle(delayCallRecords)
  checkDelayReceivesCorrectStatus(delayCallRecords, execRecords, plan, args)
  if (plan.skipRepeatAtIteration == null) {
    checkExecTiming(execRecords, plan, args)
  }
}

function checkDelayCallCount(
  delayCallRecords: DelayCallRecord[],
  plan: GeneratedDelayPlan,
): void {
  const expectedDelayCalls = plan.iterations + 1
  if (delayCallRecords.length !== expectedDelayCalls) {
    throw new Error(
      `delay call count: expected ${expectedDelayCalls}, actual ${delayCallRecords.length}`,
    )
  }
  const lastDelayCall = delayCallRecords[delayCallRecords.length - 1]
  if (lastDelayCall.result !== TASK_STOP) {
    throw new Error(`last delay call should return TASK_STOP`)
  }
}

function checkExecCount(
  execRecords: ExecRecord[],
  plan: GeneratedDelayPlan,
): void {
  const expectedExecCount = plan.iterations - plan.skipRunIndices.size
  if (execRecords.length !== expectedExecCount) {
    throw new Error(
      `execution count: expected ${expectedExecCount}, actual ${execRecords.length}`,
    )
  }
}

function checkDelayCalledWhenIdle(delayCallRecords: DelayCallRecord[]): void {
  for (let i = 0; i < delayCallRecords.length; i++) {
    if (delayCallRecords[i].statusIsRunning) {
      throw new Error(`delay[${i}] statusIsRunning should be false`)
    }
  }
}

function checkSkipRepeat(
  delayCallRecords: DelayCallRecord[],
  execRecords: ExecRecord[],
  plan: GeneratedDelayPlan,
): void {
  const skipAt = plan.skipRepeatAtIteration!

  // skipRepeat is called inside delay function at iteration skipAt.
  // The delay function still returns its result, but after exec (if !skipRun),
  // the _skipRepeat check breaks the loop.
  // So delay calls: 0..skipAt inclusive.
  // Execs: iterations 0..skipAt that don't have skipRun,
  // BUT iteration skipAt's exec still runs (skipRepeat is checked AFTER exec).
  const expectedDelayCalls = skipAt + 1
  if (delayCallRecords.length !== expectedDelayCalls) {
    throw new Error(
      `skipRepeat: delay call count: expected ${expectedDelayCalls}, actual ${delayCallRecords.length}`,
    )
  }

  let expectedExecCount = 0
  for (let i = 0; i <= skipAt; i++) {
    if (!plan.skipRunIndices.has(i)) {
      expectedExecCount++
    }
  }
  if (execRecords.length !== expectedExecCount) {
    throw new Error(
      `skipRepeat: exec count: expected ${expectedExecCount}, actual ${execRecords.length}`,
    )
  }
}

function checkDelayReceivesCorrectStatus(
  delayCallRecords: DelayCallRecord[],
  execRecords: ExecRecord[],
  plan: GeneratedDelayPlan,
  args: TestVariantsArgs,
): void {
  let expectedLastEnd: number | null = null
  let expectedLastHasError = false
  let expectedLastFailedRuns: number | null | undefined = undefined
  let expectedLastFailedReason: any = undefined
  let execIdx = 0

  for (let i = 0; i < delayCallRecords.length; i++) {
    const record = delayCallRecords[i]

    if (record.statusLastEnd !== expectedLastEnd) {
      throw new Error(
        `delay[${i}] statusLastEnd: expected ${expectedLastEnd}, actual ${record.statusLastEnd}`,
      )
    }
    if (record.statusLastHasError !== expectedLastHasError) {
      throw new Error(
        `delay[${i}] statusLastHasError: expected ${expectedLastHasError}, actual ${record.statusLastHasError}`,
      )
    }
    if (expectedLastFailedRuns == null) {
      if (record.statusLastFailedRuns != null) {
        throw new Error(
          `delay[${i}] statusLastFailedRuns: expected null/undefined, actual ${record.statusLastFailedRuns}`,
        )
      }
    } else {
      if (record.statusLastFailedRuns !== expectedLastFailedRuns) {
        throw new Error(
          `delay[${i}] statusLastFailedRuns: expected ${expectedLastFailedRuns}, actual ${record.statusLastFailedRuns}`,
        )
      }
    }

    if (expectedLastFailedReason === undefined) {
      if (record.statusLastFailedReason !== undefined) {
        throw new Error(
          `delay[${i}] statusLastFailedReason: expected undefined, actual ${JSON.stringify(record.statusLastFailedReason)}`,
        )
      }
    } else if (args.useCustomSuccessPredicate) {
      if (
        record.statusLastFailedReason == null ||
        record.statusLastFailedReason.customReason !== true ||
        record.statusLastFailedReason.error?.message !==
          expectedLastFailedReason.message
      ) {
        throw new Error(
          `delay[${i}] statusLastFailedReason: expected custom reason with error message "${expectedLastFailedReason?.message}", actual ${JSON.stringify(record.statusLastFailedReason)}`,
        )
      }
    } else {
      if (
        record.statusLastFailedReason == null ||
        record.statusLastFailedReason.message !==
          expectedLastFailedReason.message
      ) {
        throw new Error(
          `delay[${i}] statusLastFailedReason: expected message "${expectedLastFailedReason?.message}", actual "${record.statusLastFailedReason?.message}"`,
        )
      }
    }

    if (i < plan.iterations) {
      if (!plan.skipRunIndices.has(i)) {
        const exec = execRecords[execIdx]
        expectedLastEnd = exec.end
        expectedLastHasError = exec.threw

        if (exec.threw) {
          expectedLastFailedRuns = (expectedLastFailedRuns ?? 0) + 1
          expectedLastFailedReason = new Error(`exec error ${execIdx}`)
        } else {
          expectedLastFailedRuns = 0
          expectedLastFailedReason = undefined
        }

        execIdx++
      }
    }
  }
}

function checkExecTiming(
  execRecords: ExecRecord[],
  plan: GeneratedDelayPlan,
  args: TestVariantsArgs,
): void {
  let execIdx = 0
  let prevExecEnd: number | null = null
  let accumulatedDelay = 0

  for (let i = 0; i < plan.iterations; i++) {
    if (plan.skipRunIndices.has(i)) {
      accumulatedDelay += plan.delays[i]
      continue
    }

    const exec = execRecords[execIdx]

    const expectedStart =
      prevExecEnd != null ? prevExecEnd + accumulatedDelay : accumulatedDelay
    if (exec.start !== expectedStart) {
      throw new Error(
        `exec[${execIdx}] start: expected ${expectedStart}, actual ${exec.start}` +
          `; prevEnd=${prevExecEnd} accumulatedDelay=${accumulatedDelay}`,
      )
    }

    const expectedEnd = exec.start + args.executionDuration
    if (exec.end !== expectedEnd) {
      throw new Error(
        `exec[${execIdx}] end: expected ${expectedEnd}, actual ${exec.end}`,
      )
    }

    prevExecEnd = exec.end
    accumulatedDelay = plan.delays[i]
    execIdx++
  }
}

describe('TaskRepeated', { timeout: 7 * 60 * 60 * 1000 }, () => {
  it('variants', async () => {
    await testVariants({
      executionDuration: [0, 1, 3, 5],
      iterationsMax: [1, 2, 3, 5, 10],
      delayTimeMax: [0, 1, 5, 10],
      skipRunProbabilityPercent: [0, 30, 50],
      errorProbabilityPercent: [0, 20],
      funcDelayProbabilityPercent: [0, 40],
      useImmediate: [false, true],
      skipRepeatProbabilityPercent: [0, 30],
      useCustomSuccessPredicate: [false, true],
    })({
      limitTime: 60 * 1000,
      parallel: 1,
      cycles: 1e9,
      getSeed: () => getRandomSeed(),
      timeout: 1000,
      findBestError: {
        limitArgOnError: false,
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
        dir: 'tmp/test/TaskRepeated/variants',
        attemptsPerVariant: 10,
        useToFindBestError: false,
      },
    })
  })
})

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
 * - isRetry - delay marked as retry
 * - error - whether task function threw
 * - actualStart, actualEnd - execution timestamps relative to origin
 * - result - return value from task function
 * - lastEnd - status.lastEnd relative to origin at time delay was called
 * - lastHasError - status.lastHasError at time delay was called
 * - countRetry - status.countRetry at time delay was called
 *
 * Example trace:
 * [test][delay][0] lastEnd=null lastHasError=false countRetry=null → delayMs=5 stop=false skipRun=false isRetry=false
 * [test][exec][0] actualStart=0 actualEnd=3 result=0 error=false
 * [test][delay][1] lastEnd=3 lastHasError=false countRetry=null → delayMs=5 stop=false skipRun=false isRetry=true
 * [test][exec][1] actualStart=8 actualEnd=11 result=1 error=true
 * [test][delay][2] lastEnd=11 lastHasError=true countRetry=0 → delayMs=null stop=true skipRun=false isRetry=false
 * [test] DONE executions=2
 */
import { describe, it } from 'vitest'
import { createTestVariants } from '@flemist/test-variants'
import { TimeControllerMock } from '@flemist/time-controller'
import { type TaskDelay, type TaskStatusBase } from './types'
import { LogLevel } from 'src/common/debug'
import { waitTimeControllerMock } from '@flemist/async-utils'
import { getRandomSeed, Random, randomInt } from 'src/common/random'
import { createTaskRepeated } from './TaskRepeated'

export type TestVariantsArgs = {
  seed: number
  executionDuration: number
  iterationsMax: number
  delayTimeMax: number
  skipRunProbabilityPercent: number
  errorProbabilityPercent: number
  retryProbabilityPercent: number
  useImmediate: boolean
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
  statusCountRetry: number | null | undefined
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
  retryIndices: Set<number>
  errorExecIndices: Set<number>
}

type TestContext = {
  log: boolean
  timeController: TimeControllerMock
  task: ReturnType<typeof createTaskRepeated>
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
  const retryIndices = new Set<number>()

  for (let i = 0; i < iterations; i++) {
    delays.push(randomInt(rnd, 0, args.delayTimeMax + 1))
    if (
      args.skipRunProbabilityPercent > 0 &&
      randomInt(rnd, 0, 100) < args.skipRunProbabilityPercent
    ) {
      skipRunIndices.add(i)
    }
    if (
      args.retryProbabilityPercent > 0 &&
      randomInt(rnd, 0, 100) < args.retryProbabilityPercent
    ) {
      retryIndices.add(i)
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

  return { iterations, delays, skipRunIndices, retryIndices, errorExecIndices }
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

  const task = createTaskRepeated<null, number>(
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
      delay(status: TaskStatusBase<number>): TaskDelay<number> {
        const i = delayIndex++
        const shouldStop = i >= plan.iterations

        const isRetry = plan.retryIndices.has(i) || undefined
        const delayResult: TaskDelay<number> = shouldStop
          ? { stop: true }
          : {
              delay: isRetry
                ? () => ({
                    delay: plan.delays[i],
                    retry: true,
                  })
                : plan.delays[i],
              skipRun: plan.skipRunIndices.has(i),
            }

        const record: DelayCallRecord = {
          index: i,
          statusLastEnd:
            status.lastEnd == null ? null : status.lastEnd - originTime,
          statusLastHasError: status.lastHasError,
          statusIsRunning: status.isRunning,
          statusCountRetry: status.countRetry,
          result: delayResult,
        }
        delayCallRecords.push(record)

        if (log) {
          console.log(
            `[test][delay][${i}] lastEnd=${record.statusLastEnd} lastHasError=${record.statusLastHasError} countRetry=${record.statusCountRetry}` +
              ` → delayMs=${plan.delays[i] ?? null} stop=${delayResult.stop ?? false} skipRun=${delayResult.skipRun ?? false} isRetry=${isRetry ?? false}`,
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
    let result: any
    let caughtError: any
    try {
      result = await waitTimeControllerMock(
        timeController,
        Promise.resolve(task.run({ immediate: true })),
        { awaitsPerIteration: 1 },
      )
    } catch (err) {
      caughtError = err
    }

    if (log) {
      console.log(
        `[test] IMMEDIATE result=${result} error=${!!caughtError} execCount=${execRecords.length}`,
      )
    }

    if (execRecords.length !== 1) {
      throw new Error(
        `immediate: execCount expected 1, actual ${execRecords.length}`,
      )
    }
    if (execRecords[0].start !== 0) {
      throw new Error(
        `immediate: start expected 0, actual ${execRecords[0].start}`,
      )
    }
    if (delayCallRecords.length !== 0) {
      throw new Error(
        `immediate: should not call delay, but called ${delayCallRecords.length} times`,
      )
    }
    if (execRecords[0].threw) {
      if (!caughtError) {
        throw new Error(`immediate: expected error to propagate but it did not`)
      }
    } else {
      if (caughtError) {
        throw new Error(`immediate: unexpected error: ${caughtError.message}`)
      }
      if (result !== 0) {
        throw new Error(`immediate: result expected 0, actual ${result}`)
      }
    }
    return
  }

  if (plan.iterations === 0) {
    let rejected = false
    ;(task.run() as Promise<any>).catch(() => {
      rejected = true
    })

    await waitTimeControllerMock(timeController, null, { timeout: 100 })

    if (log) {
      console.log(`[test] STOP-IMMEDIATELY rejected=${rejected}`)
    }

    if (delayCallRecords.length !== 1) {
      throw new Error(
        `stop-immediately: expected 1 delay call, actual ${delayCallRecords.length}`,
      )
    }
    if (!delayCallRecords[0].result.stop) {
      throw new Error(`stop-immediately: first delay should return stop=true`)
    }
    if (execRecords.length !== 0) {
      throw new Error(
        `stop-immediately: expected 0 executions, actual ${execRecords.length}`,
      )
    }
    if (!rejected) {
      throw new Error(`stop-immediately: run() should reject with abort error`)
    }
    return
  }

  const runPromise = (task.run() as Promise<any>).catch(() => {})

  const maxTime =
    (plan.iterations + 1) * (args.executionDuration + args.delayTimeMax + 10)
  await waitTimeControllerMock(timeController, null, {
    timeout: maxTime,
  })
  await runPromise

  if (log) {
    console.log(`[test] DONE executions=${execRecords.length}`)
  }

  checkDelayCallCount(delayCallRecords, plan)
  checkExecCount(execRecords, plan)
  checkDelayCalledWhenIdle(delayCallRecords)
  checkDelayReceivesCorrectStatus(delayCallRecords, execRecords, plan)
  checkExecTiming(execRecords, plan, args)
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
  if (!lastDelayCall.result.stop) {
    throw new Error(`last delay call should have stop=true`)
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

function checkDelayReceivesCorrectStatus(
  delayCallRecords: DelayCallRecord[],
  execRecords: ExecRecord[],
  plan: GeneratedDelayPlan,
): void {
  let expectedLastEnd: number | null = null
  let expectedLastHasError = false
  let expectedCountRetry: number | null | undefined = undefined
  let nextIsRetry = false
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
    if (expectedCountRetry == null) {
      if (record.statusCountRetry != null) {
        throw new Error(
          `delay[${i}] statusCountRetry: expected null/undefined, actual ${record.statusCountRetry}`,
        )
      }
    } else {
      if (record.statusCountRetry !== expectedCountRetry) {
        throw new Error(
          `delay[${i}] statusCountRetry: expected ${expectedCountRetry}, actual ${record.statusCountRetry}`,
        )
      }
    }

    if (i < plan.iterations) {
      // Delay function at this iteration sets nextIsRetry for the NEXT run
      const thisRetry = plan.retryIndices.has(i)

      if (!plan.skipRunIndices.has(i)) {
        const exec = execRecords[execIdx]
        expectedLastEnd = exec.end
        expectedLastHasError = exec.threw

        // countRetry logic from TaskBase.onStart:
        // isRetry == null → countRetry = null
        // isRetry == true && prev countRetry == null → countRetry = 0
        // isRetry == true && prev countRetry != null → countRetry + 1
        // nextIsRetry is set by delay function result at PREVIOUS iteration
        if (!nextIsRetry) {
          expectedCountRetry = null
        } else if (expectedCountRetry == null) {
          expectedCountRetry = 0
        } else {
          expectedCountRetry = expectedCountRetry + 1
        }

        execIdx++
      }

      nextIsRetry = thisRetry
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
      retryProbabilityPercent: [0, 40],
      useImmediate: [false, true],
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
          limitTests: 1000,
        },
        {
          mode: 'random',
          limitTests: 100000,
        },
        {
          mode: 'backward',
          limitTests: 1000,
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

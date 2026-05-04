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
 * - [i] - delay call index
 * - delayMs - numeric delay value returned
 * - stop - delay requested loop stop
 * - skipRun - delay requested skip execution
 * - isRetry - delay marked as retry
 * - actualStart, actualEnd - execution timestamps relative to origin
 * - result - return value from task function
 * - lastEnd - status.lastEnd relative to origin at time delay was called
 * - lastHasError - status.lastHasError at time delay was called
 *
 * Example trace:
 * [test][delay][0] lastEnd=null lastHasError=false → delayMs=5 stop=false skipRun=false isRetry=false
 * [test][exec][0] actualStart=0 actualEnd=3 result=0
 * [test][delay][1] lastEnd=3 lastHasError=false → delayMs=5 stop=false skipRun=false isRetry=false
 * [test][exec][1] actualStart=8 actualEnd=11 result=1
 * [test][delay][2] lastEnd=11 lastHasError=false → delayMs=null stop=true skipRun=false isRetry=false
 * [test] DONE executions=2
 */
import { describe, it } from 'vitest'
import { createTestVariants } from '@flemist/test-variants'
import { TimeControllerMock } from '@flemist/time-controller'
import {
  createTaskRepeated,
  type TaskDelayResult,
  type TaskStatusBase,
} from './types'
import { LogLevel } from 'src/common/debug'
import { waitTimeControllerMock } from '@flemist/async-utils'
import { getRandomSeed, Random, randomInt } from 'src/common/random'

export type TestVariantsArgs = {
  seed: number
  executionDuration: number
  iterationsMax: number
  delayTimeMax: number
  skipRunProbabilityPercent: number
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
  result: TaskDelayResult
}

type ExecRecord = {
  start: number
  end: number
  result: number
}

type GeneratedDelayPlan = {
  iterations: number
  delays: number[]
  skipRunIndices: Set<number>
}

type TestContext = {
  log: boolean
  timeController: TimeControllerMock
  task: ReturnType<typeof createTaskRepeated<any, any, any, any>>
  originTime: number
  execRecords: ExecRecord[]
  delayCallRecords: DelayCallRecord[]
  plan: GeneratedDelayPlan
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
  const iterations = randomInt(rnd, 1, args.iterationsMax + 1)
  const delays: number[] = []
  const skipRunIndices = new Set<number>()

  for (let i = 0; i < iterations; i++) {
    delays.push(randomInt(rnd, 0, args.delayTimeMax + 1))
    if (
      args.skipRunProbabilityPercent > 0 &&
      randomInt(rnd, 0, 100) < args.skipRunProbabilityPercent
    ) {
      skipRunIndices.add(i)
    }
  }

  return { iterations, delays, skipRunIndices }
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

  const task = createTaskRepeated<any, any, any, any>(
    async () => {
      const funcStart = timeController.now() - originTime
      timeController.addTime(args.executionDuration)
      const funcEnd = timeController.now() - originTime
      const result = callCount++
      execRecords.push({ start: funcStart, end: funcEnd, result })
      if (log) {
        console.log(
          `[test][exec][${result}] actualStart=${funcStart} actualEnd=${funcEnd} result=${result}`,
        )
      }
      return result
    },
    null,
    {
      timeController,
      delay(status: TaskStatusBase<any>): TaskDelayResult {
        const i = delayIndex++
        const shouldStop = i >= plan.iterations

        const delayResult: TaskDelayResult = shouldStop
          ? { stop: true }
          : {
              delay: plan.delays[i],
              skipRun: plan.skipRunIndices.has(i),
            }

        const record: DelayCallRecord = {
          index: i,
          statusLastEnd:
            status.lastEnd == null ? null : status.lastEnd - originTime,
          statusLastHasError: status.lastHasError,
          statusIsRunning: status.isRunning,
          result: delayResult,
        }
        delayCallRecords.push(record)

        if (log) {
          console.log(
            `[test][delay][${i}] lastEnd=${record.statusLastEnd} lastHasError=${record.statusLastHasError}` +
              ` → delayMs=${delayResult.delay ?? null} stop=${delayResult.stop ?? false} skipRun=${delayResult.skipRun ?? false}`,
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

  task.run()

  const maxTime =
    (plan.iterations + 1) * (args.executionDuration + args.delayTimeMax + 10)
  await waitTimeControllerMock(timeController, null, {
    timeout: maxTime,
  })

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
  let execIdx = 0

  for (let i = 0; i < delayCallRecords.length; i++) {
    const record = delayCallRecords[i]

    if (record.statusLastEnd !== expectedLastEnd) {
      throw new Error(
        `delay[${i}] statusLastEnd: expected ${expectedLastEnd}, actual ${record.statusLastEnd}`,
      )
    }

    if (i < plan.iterations && !plan.skipRunIndices.has(i)) {
      expectedLastEnd = execRecords[execIdx].end
      execIdx++
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
  it('stop-on-first-delay-hangs-run', async () => {
    const timeController = new TimeControllerMock()
    let delayCalls = 0

    const task = createTaskRepeated<any, any, any, any>(
      async () => {
        timeController.addTime(1)
        return 'result'
      },
      null,
      {
        timeController,
        delay(): TaskDelayResult {
          delayCalls++
          return { stop: true }
        },
      },
    )

    let resolved = false
    ;(task.run() as Promise<any>).then(() => {
      resolved = true
    })

    await waitTimeControllerMock(timeController, null, { timeout: 100 })

    if (delayCalls !== 1) {
      throw new Error(`expected 1 delay call, got ${delayCalls}`)
    }
    if (resolved) {
      throw new Error('run() should not resolve when delay immediately stops')
    }
  })

  it('immediate', async () => {
    const timeController = new TimeControllerMock()
    const originTime = timeController.now()
    const execRecords: ExecRecord[] = []
    let callCount = 0
    let delayCalls = 0

    const task = createTaskRepeated<any, any, any, any>(
      async () => {
        const funcStart = timeController.now() - originTime
        timeController.addTime(3)
        const funcEnd = timeController.now() - originTime
        const result = callCount++
        execRecords.push({ start: funcStart, end: funcEnd, result })
        return result
      },
      null,
      {
        timeController,
        delay(): TaskDelayResult {
          delayCalls++
          return { stop: true }
        },
      },
    )

    const result = await waitTimeControllerMock(
      timeController,
      Promise.resolve(task.run({ immediate: true })),
      { awaitsPerIteration: 1 },
    )

    if (result !== 0) {
      throw new Error(`immediate result: expected 0, actual ${result}`)
    }
    if (execRecords.length !== 1) {
      throw new Error(
        `immediate execCount: expected 1, actual ${execRecords.length}`,
      )
    }
    if (execRecords[0].start !== 0) {
      throw new Error(
        `immediate start: expected 0, actual ${execRecords[0].start}`,
      )
    }
    if (delayCalls !== 0) {
      throw new Error(
        `immediate should not call delay function, but called ${delayCalls} times`,
      )
    }
  })

  it('isRetry', async () => {
    const timeController = new TimeControllerMock()
    let callCount = 0
    let delayIndex = 0
    const statusSnapshots: { countRetry: null | number | undefined }[] = []

    const task = createTaskRepeated<any, any, any, any>(
      async () => {
        callCount++
        timeController.addTime(1)
        return callCount
      },
      null,
      {
        timeController,
        delay(status: TaskStatusBase<any>): TaskDelayResult {
          const i = delayIndex++
          statusSnapshots.push({ countRetry: status.countRetry })
          if (i >= 4) {
            return { stop: true }
          }
          return { delay: 1, isRetry: i >= 2 }
        },
      },
    )

    task.run()
    await waitTimeControllerMock(timeController, null, { timeout: 100 })

    // delay[0]: no prev exec → countRetry null
    // delay[1]: after exec with isRetry=undefined → countRetry null
    // delay[2]: after exec with isRetry=undefined → countRetry null
    // delay[3]: after exec with isRetry=true → countRetry 0 (first retry)
    // delay[4]: after exec with isRetry=true → countRetry 1 (second retry, stop)
    const expectedRetry: (number | null)[] = [null, null, null, 0, 1]
    for (let i = 0; i < expectedRetry.length; i++) {
      const expected = expectedRetry[i]
      const actual = statusSnapshots[i].countRetry
      if (expected == null) {
        if (actual != null) {
          throw new Error(`retry[${i}]: expected null, actual ${actual}`)
        }
      } else {
        if (actual !== expected) {
          throw new Error(`retry[${i}]: expected ${expected}, actual ${actual}`)
        }
      }
    }
  })

  it('error-handling', async () => {
    const timeController = new TimeControllerMock()
    let callCount = 0
    let delayIndex = 0
    const statusSnapshots: { lastHasError: boolean; lastError?: any }[] = []

    const task = createTaskRepeated<any, any, any, any>(
      async () => {
        const i = callCount++
        timeController.addTime(1)
        if (i === 1) {
          throw new Error('test error')
        }
        return i
      },
      null,
      {
        timeController,
        logLevel: LogLevel.none,
        delay(status: TaskStatusBase<any>): TaskDelayResult {
          const i = delayIndex++
          statusSnapshots.push({
            lastHasError: status.lastHasError,
            lastError: status.lastError,
          })
          if (i >= 4) {
            return { stop: true }
          }
          return { delay: 1 }
        },
      },
    )

    task.run()
    await waitTimeControllerMock(timeController, null, { timeout: 100 })

    // delay[0]: initial → lastHasError=false
    // delay[1]: after exec[0] success → lastHasError=false
    // delay[2]: after exec[1] error → lastHasError=true
    // delay[3]: after exec[2] success → lastHasError=false
    // delay[4]: after exec[3] success → lastHasError=false (stop)
    if (statusSnapshots[0].lastHasError) {
      throw new Error('error[0]: expected lastHasError=false')
    }
    if (statusSnapshots[1].lastHasError) {
      throw new Error('error[1]: expected lastHasError=false')
    }
    if (!statusSnapshots[2].lastHasError) {
      throw new Error('error[2]: expected lastHasError=true')
    }
    if (statusSnapshots[2].lastError?.message !== 'test error') {
      throw new Error(
        `error[2]: expected lastError.message='test error', got ${statusSnapshots[2].lastError?.message}`,
      )
    }
    if (statusSnapshots[3].lastHasError) {
      throw new Error(
        'error[3]: expected lastHasError=false after successful exec',
      )
    }
    if (callCount !== 4) {
      throw new Error(`expected 4 task calls, got ${callCount}`)
    }
    if (statusSnapshots.length !== 5) {
      throw new Error(`expected 5 delay calls, got ${statusSnapshots.length}`)
    }
  })

  it('variants', async () => {
    await testVariants({
      executionDuration: [0, 1, 3, 5],
      iterationsMax: [1, 2, 3, 5, 10],
      delayTimeMax: [0, 1, 5, 10],
      skipRunProbabilityPercent: [0, 30, 50],
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

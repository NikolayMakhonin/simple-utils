/**
 * Logging: disabled by default, enabled only on error (test re-runs with log: true)
 *
 * General format:
 * - Log entries: bracket-path style with [test] prefix
 *
 * Entity naming:
 * - action-N - Nth action (0-indexed), where N is the action id
 *
 * Actions:
 * - Actions - generated action list with all parameters
 * - added - action added to queue after addTime delay
 * - started sync - synchronous action started execution
 * - started async - asynchronous action started execution
 *
 * Parameters:
 * - id - action identifier
 * - priority - priority value or null
 * - addTime - time offset when action is added to queue
 * - readyToRunTime - time offset from addTime when task becomes ready to run, null for immediate
 * - abortTime - time offset from addTime when abort fires, null for no abort
 * - duration - execution duration
 * - throwError - whether the action throws TestError
 * - time - mock time when action started
 *
 * Example trace:
 * [test] Actions: [{id: 0, priority: 1, addTime: 0, ...}, {id: 1, priority: null, addTime: 2, ...}]
 * [test][action-0] added; priority: 1; addTime: 0
 * [test][action-0] started sync; time: 0
 * [test][action-1] added; priority: null; addTime: 2
 * [test][action-1] started async; time: 2; duration: 3
 */
import { describe, it } from 'vitest'
import { PriorityQueue } from './PriorityQueue'
import { priorityCreate } from 'src/common/async/priority/Priority'
import { createTestVariants } from '@flemist/test-variants'
import {
  type IAbortControllerFast,
  AbortControllerFast,
  AbortError,
  type IAbortSignalFast,
} from '@flemist/abort-controller-fast'
import { TimeControllerMock } from '@flemist/time-controller'
import { delay } from 'src/common/async/wait/delay'
import { waitTimeControllerMock } from 'src/common/async/wait/waitTimeControllerMock'
import {
  arrayShuffle,
  getRandomSeed,
  Random,
  randomBoolean,
  randomInt,
} from 'src/common/random'
import { formatAny, type FormatAnyOptions } from 'src/common/string'
import { deepEqualJsonLike } from 'src/common/object'
import type { PriorityQueueRunFunc } from './contracts'

function formatObject(obj: any, options?: null | FormatAnyOptions): string {
  return formatAny(obj, {
    maxDepth: 10,
    maxItems: 50,
    ...options,
  })
}

export type TestVariantsArgs = {
  seed: number

  actionsCount: number
  readyToRunTimeMax: number | null
  abortTimeMax: number | null
  throwError: boolean
  priorityMax: number | null
  addTimeMax: number
  durationMax: number
}

const testVariants = createTestVariants(async (args: TestVariantsArgs) => {
  const rnd = new Random(args.seed)
  try {
    const context = generateContext({ rnd: rnd.clone(), args, log: false })
    await test({ context })
  } catch (err) {
    try {
      const context = generateContext({ rnd: rnd.clone(), args, log: true })
      await test({ context })
    } catch {
      // Ignore re-run error, throw original
    }
    throw err
  }
})

type GenerateContextOptions = {
  rnd: Random
  args: TestVariantsArgs
  log: boolean
}

type Action = {
  id: number
  priority: number | null
  addTime: number
  /** from addTime */
  readyToRunTime: number | null
  /** from addTime */
  abortTime: number | null
  duration: number
  throwError: boolean
}

function generateContext(options: GenerateContextOptions): TestContext {
  let hasError = false
  let firstError: any = null
  function onError(error: any) {
    if (hasError) {
      return
    }
    hasError = true
    firstError = error
  }

  const priorityQueue = new PriorityQueue()
  const timeController = new TimeControllerMock()
  const orderActual: number[] = []
  const actions = generateActions(options)
  const orderExpected = calculateOrder(actions)

  return {
    log: options.log,
    throwIfError() {
      if (hasError) {
        throw firstError
      }
    },
    onError,
    priorityQueue,
    timeController,
    actions,
    orderActual,
    orderExpected,
  }
}

class TestError extends Error {}

function generateActions(options: GenerateContextOptions): Action[] {
  const { rnd, args, log } = options
  const actions: Action[] = []
  for (let i = 0; i < args.actionsCount; i++) {
    const action = generateAction(options, i)
    actions.push(action)
  }
  arrayShuffle(rnd, actions)

  if (log) {
    console.log(`[test] Actions: ${formatObject(actions)}`)
  }

  return actions
}

function generateAction(options: GenerateContextOptions, id: number): Action {
  const { rnd, args } = options

  const priority = randomIntWithNull(rnd, args.priorityMax)
  const addTime = randomInt(rnd, 0, args.addTimeMax + 1)
  const readyToRunTime = randomIntWithNull(rnd, args.readyToRunTimeMax)
  const abortTime = randomIntWithNull(rnd, args.abortTimeMax)
  const duration = randomInt(rnd, 0, args.durationMax + 1)
  const throwError = args.throwError ? randomBoolean(rnd) : false

  return {
    id,
    priority,
    addTime,
    readyToRunTime,
    abortTime,
    duration,
    throwError,
  }
}

function randomIntWithNull(rnd: Random, max: number | null): number | null {
  if (max == null) {
    return null
  }
  if (randomBoolean(rnd)) {
    return null
  }
  return randomInt(rnd, 0, max + 1)
}

function calculateOrder(actions: Action[]): number[] {
  // TODO
}

type TestContext = {
  log: boolean
  throwIfError: () => void
  onError: (error: any) => void
  priorityQueue: PriorityQueue
  timeController: TimeControllerMock
  /** Actions to add to the queue, in the order of adding */
  actions: Action[]
  /** Actual order action ids */
  orderActual: number[]
  /** Expected order action ids */
  orderExpected: number[]
}

async function runAction(context: TestContext, action: Action): Promise<void> {
  const { log, priorityQueue, timeController, orderActual, onError } = context

  const priority =
    action.priority != null ? priorityCreate(action.priority) : null
  await delay(action.addTime, null, timeController)

  if (log) {
    console.log(
      `[test][action-${action.id}] added; priority: ${action.priority}; addTime: ${action.addTime}`,
    )
  }

  let abortController: IAbortControllerFast | null = null
  if (action.abortTime != null) {
    abortController = new AbortControllerFast()
    if (action.abortTime === 0) {
      abortController.abort(new AbortError(`TEST_ABORT: ${action.id}`))
    } else {
      timeController.setTimeout(() => {
        abortController!.abort(new AbortError(`TEST_ABORT: ${action.id}`))
      }, action.abortTime)
    }
  }

  let started = false
  let timeStart: number | null = null

  const runFuncSync: PriorityQueueRunFunc<number> = abortSignal => {
    if (started) {
      onError(
        new Error(
          `[test] Action started multiple times: ${formatObject(action)}`,
        ),
      )
    }
    started = true

    checkAbortSignal(abortSignal, abortController?.signal)
    timeStart = timeController.now()
    orderActual.push(action.id)

    if (log) {
      console.log(
        `[test][action-${action.id}] started sync; time: ${timeStart}`,
      )
    }

    if (action.throwError) {
      throw new TestError(`TEST_ERROR: ${action.id}`)
    }

    return action.id
  }

  const runFuncAsync: PriorityQueueRunFunc<number> = async abortSignal => {
    if (started) {
      onError(
        new Error(
          `[test] Action started multiple times: ${formatObject(action)}`,
        ),
      )
    }
    started = true

    checkAbortSignal(abortSignal, abortController?.signal)
    timeStart = timeController.now()
    orderActual.push(action.id)

    if (log) {
      console.log(
        `[test][action-${action.id}] started async; time: ${timeStart}; duration: ${action.duration}`,
      )
    }

    await delay(action.duration, abortSignal, timeController)
    checkAbortSignal(abortSignal, abortController?.signal)

    if (action.throwError) {
      throw new TestError(`TEST_ERROR: ${action.id}`)
    }

    return action.id
  }

  const runFunc = action.duration === 0 ? runFuncSync : runFuncAsync

  let runResult: number | null = null
  let runError: TestError | AbortError | null = null
  try {
    if (action.readyToRunTime != null) {
      const task = priorityQueue.runTask(
        runFunc,
        priority,
        abortController?.signal,
      )
      timeController.setTimeout(() => {
        task.setReadyToRun(true)
      }, action.readyToRunTime)
      runResult = await task.result
    } else {
      runResult = await priorityQueue.run(
        runFunc,
        priority,
        abortController?.signal,
      )
    }
  } catch (error: any) {
    if (error instanceof TestError || error instanceof AbortError) {
      runError = error
    } else {
      throw error
    }
  }

  checkActionResult(action, timeController, runResult, runError, timeStart)
}

function checkAbortSignal(
  actual: IAbortSignalFast | null | undefined,
  expected: IAbortSignalFast | null | undefined,
) {
  if ((actual == null) !== (expected == null)) {
    throw new Error(
      `[test] Abort signal presence mismatch, (actual == null)(${actual == null}) !== (expected == null)(${expected == null})`,
    )
  }
  if (actual == null || expected == null) {
    return
  }
  if (actual.aborted !== expected.aborted) {
    throw new Error(
      `[test] Abort signal aborted state mismatch, actual.aborted: ${actual.aborted} !== expected.aborted: ${expected.aborted}`,
    )
  }
}

function checkActionResult(
  action: Action,
  timeController: TimeControllerMock,
  runResult: number | null,
  runError: TestError | AbortError | null,
  timeStart: number | null,
): void {
  const shouldAbort =
    action.abortTime != null &&
    action.abortTime <= (action.readyToRunTime ?? 0) + action.duration
  const shouldAbortBeforeStart =
    action.abortTime != null && action.abortTime <= (action.readyToRunTime ?? 0)

  if (shouldAbort) {
    if (runError == null) {
      throw new Error(
        `[test] Action was expected to be aborted but completed successfully: ${formatObject(
          action,
        )}`,
      )
    }
    if (!(runError instanceof AbortError)) {
      throw new Error(
        `[test] Action was expected to be aborted but threw different error: ${formatObject(
          action,
        )}, error: ${formatObject(runError)}`,
      )
    }
    if (runError.message !== `TEST_ABORT: ${action.id}`) {
      throw new Error(
        `[test] Action was aborted with unexpected error message: ${formatObject(
          action,
        )}, error: ${formatObject(runError)}`,
      )
    }
  } else if (runError instanceof AbortError) {
    throw new Error(
      `[test] Action was not expected to be aborted but was aborted: ${formatObject(
        action,
      )}, error: ${formatObject(runError)}`,
    )
  } else if (action.throwError) {
    if (runError == null) {
      throw new Error(
        `[test] Action should throw error but did not: ${formatObject(action)}`,
      )
    }
    if (runError.message !== `TEST_ERROR: ${action.id}`) {
      throw new Error(
        `[test] Action threw unexpected error: ${formatObject({
          action,
          runError,
        })}`,
      )
    }
  } else {
    if (runError != null) {
      throw new Error(
        `[test] Action threw error but should not: ${formatObject({
          action,
          runError,
        })}`,
      )
    }
    if (runResult !== action.id) {
      throw new Error(
        `[test] Action run result unexpected: ${formatObject({
          action,
          runResult,
        })}`,
      )
    }
  }

  if (shouldAbortBeforeStart) {
    if (timeStart != null) {
      throw new Error(
        `[test] Action was expected to be aborted before start but has start time: ${formatObject(
          action,
        )}, timeStart: ${timeStart}`,
      )
    }
  } else if (timeStart == null) {
    throw new Error(
      `[test] Action run func did not start: ${formatObject(action)}`,
    )
  } else {
    const durationActual = timeController.now() - timeStart
    const durationExpected =
      action.abortTime == null
        ? action.duration
        : Math.max(
            0,
            Math.min(
              action.duration,
              action.abortTime - (action.readyToRunTime ?? 0),
            ),
          )
    if (durationActual !== durationExpected) {
      throw new Error(
        `[test] duration actual (${durationActual}) !== expected (${durationExpected}) for action ${formatObject(action)}`,
      )
    }
  }
}

type TestOptions = {
  context: TestContext
}

async function test(options: TestOptions): Promise<void> {
  const { context } = options
  const { throwIfError, timeController, actions, orderActual, orderExpected } =
    context

  const promises = actions.map(action => runAction(context, action))

  let hasError = false
  let error: any = null
  let hasResult = false
  Promise.all(promises).then(
    () => {
      hasResult = true
    },
    reason => {
      hasError = true
      error = reason
    },
  )

  await waitTimeControllerMock(timeController)
  throwIfError()

  if (hasError) {
    throw error
  }
  if (!hasResult) {
    throw new Error(
      `[test] Actions did not complete in time:\n${formatObject({ actions, orderActual, orderExpected })}`,
    )
  }
  if (!deepEqualJsonLike(orderActual, orderExpected)) {
    throw new Error(
      `[test] Order actual !== expected:\n${formatObject({ actions, orderActual, orderExpected })}`,
    )
  }

  timeController.addTime(1e9)
  await waitTimeControllerMock(timeController)
  throwIfError()
}

describe('PriorityQueue', { timeout: 7 * 60 * 60 * 1000 }, () => {
  it('variants', async () => {
    await testVariants({
      actionsCount: Array.from({ length: 100 }, (_, i) => i + 1),
      readyToRunTimeMax: [null, ...Array.from({ length: 50 }, (_, i) => i)],
      abortTimeMax: [null, ...Array.from({ length: 50 }, (_, i) => i)],
      throwError: [false, true],
      priorityMax: [null, ...Array.from({ length: 10 }, (_, i) => i)],
      addTimeMax: Array.from({ length: 50 }, (_, i) => i),
      durationMax: Array.from({ length: 50 }, (_, i) => i),
    })({
      limitTime: 60 * 1000,
      parallel: 1,
      cycles: 1e9,
      getSeed: () => getRandomSeed(),
      timeout: 1000,
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
        dir: 'tmp/test/PriorityQueue/variants',
        attemptsPerVariant: 10,
        useToFindBestError: false,
      },
    })
  })
})

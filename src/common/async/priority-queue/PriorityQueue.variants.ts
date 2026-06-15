import { describe, it, assert } from 'vitest'
import { PriorityQueue } from './PriorityQueue'
import { priorityCreate } from 'src/common/async/priority/Priority'
import { createTestVariants } from '@flemist/test-variants'
import {
  type IAbortSignalFast,
  type IAbortControllerFast,
  AbortControllerFast,
  AbortError,
} from '@flemist/abort-controller-fast'
import { TimeControllerMock } from '@flemist/time-controller'
import { delay, waitTimeControllerMock } from 'src/common/async/wait'
import {
  arrayShuffle,
  getRandomSeed,
  Random,
  randomBoolean,
  randomInt,
} from 'src/common/random'
import { formatAny, type FormatAnyOptions } from 'src/common/string'
import { deepEqualJsonLike } from 'src/common/object'

function formatObject(obj: any, options?: null | FormatAnyOptions): string {
  return formatAny(obj, {
    maxDepth: 5,
    maxItems: 10,
    ...options,
  })
}

type TestVariantsArgs = {
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
    test({ rnd: rnd.clone(), context, args })
  } catch (err) {
    try {
      const context = generateContext({ rnd: rnd.clone(), args, log: true })
      test({ rnd: rnd.clone(), context, args })
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
  const { args, log } = options

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

  async function run(action: Action): Promise<void> {
    const priority =
      action.priority != null ? priorityCreate(action.priority) : null
    if (action.addTime != null) {
      await delay(action.addTime, null, timeController)
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

    const runFunc = async (
      abortSignal?: null | IAbortSignalFast,
    ): Promise<number> => {
      if (started) {
        onError(
          new Error(
            `[test] Action started multiple times: ${formatObject(action)}`,
          ),
        )
      }
      started = true

      timeStart = timeController.now()
      orderActual.push(action.id)
      await delay(action.duration, abortSignal, timeController)

      if (action.throwError) {
        throw new TestError(`TEST_ERROR: ${action.id}`)
      }

      return action.id
    }

    let runResult: number | null = null as any
    let runError: TestError | AbortError | null = null as any
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

    if (timeStart == null) {
      throw new Error(
        `[test] Action run func did not start: ${formatObject(action)}`,
      )
    }

    if (
      action.abortTime != null &&
      action.abortTime <= (action.readyToRunTime ?? 0) + action.duration
    ) {
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
    }

    if (action.throwError) {
      if (runError == null) {
        throw new Error(
          `[test] Action should throw error but did not: ${formatObject({
            action,
          })}`,
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

    const durationActual = timeController.now() - timeStart
    if (durationActual !== action.duration) {
      throw new Error(
        `[test] duration actual (${durationActual}) !== expected (${action.duration}) for action ${formatObject(action)}`,
      )
    }
  }

  return {
    throwIfError() {
      if (hasError) {
        throw firstError
      }
    },
    timeController,
    run,
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
  throwIfError: () => void
  timeController: TimeControllerMock
  run: Run
  /** Actions to add to the queue, in the order of adding */
  actions: Action[]
  /** Actual order action ids */
  orderActual: number[]
  /** Expected order action ids */
  orderExpected: number[]
}

type Run = (action: Action) => Promise<void>

type TestOptions = {
  rnd: Random
  context: TestContext
  args: TestVariantsArgs
}

async function test(options: TestOptions): Promise<void> {
  const { rnd, context, args } = options
  const { throwIfError, timeController, actions, orderActual, orderExpected } =
    context

  const promises = actions.map(action => context.run(action))

  let hasError = false
  let error: any = null
  let hasResult = false
  Promise.all(promises).then(
    () => {
      hasResult = true
    },
    o => {
      hasError = true
      error = o
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

describe('PriorityQueue', async () => {
  it('variants', async () => {
    await testVariants({
      // TODO
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

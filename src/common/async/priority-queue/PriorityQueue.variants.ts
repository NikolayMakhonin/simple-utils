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
import { delay, waitTimeControllerMock } from 'src/common/async/wait'
import {
  getRandomSeed,
  Random,
  randomBoolean,
  randomInt,
  randomItem,
} from 'src/common/random'
import { formatAny, type FormatAnyOptions } from '../../string'
import { deepEqualJsonLike, equalArray } from '../../object'

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
  priority: boolean
  addTime: boolean
  taskMode: boolean
  abort: boolean
  duration: boolean
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
  /** Should be >= addTime */
  readyToRunTime: number | null
  /** Abort time, should be >= addTime */
  abortTime: number | null
  duration: number
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

  // TODO

  async function run(action: Action): Promise<void> {
    const priority =
      action.priority != null ? priorityCreate(action.priority) : null
    let abortController: IAbortControllerFast | null = null
    if (action.abortTime != null) {
      abortController = new AbortControllerFast()
      timeController.setTimeout(() => {
        abortController!.abort()
      }, action.abortTime)
    }

    if (action.addTime != null) {
      await delay(action.addTime, abortController?.signal, timeController)
    }

    let started = false
    let timeStart: number | null = null

    const runFunc = async (
      abortSignal?: null | IAbortSignalFast,
    ): Promise<void> => {
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
    }

    if (action.readyToRunTime != null) {
      const task = priorityQueue.runTask(
        runFunc,
        priority,
        abortController?.signal,
      )
      timeController.setTimeout(() => {
        task.setReadyToRun(true)
      }, action.readyToRunTime)
      await task.result
    } else {
      await priorityQueue.run(runFunc, priority, abortController?.signal)
    }

    if (timeStart == null) {
      throw new Error(
        `[test] Action run func did not start: ${formatObject(action)}`,
      )
    }

    const durationActual = timeController.now() - timeStart
    if (durationActual !== action.duration) {
      throw new Error(
        `[test] duration actual (${action.duration}) !== expected (${durationActual}) for action ${formatObject(action)}`,
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

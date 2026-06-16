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
import { describe, it, assert } from 'vitest'
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

// Simulation phases within the same time tick.
// PHASE_EARLY: completions, aborts, adds, non-zero readyToRunTime.
// PHASE_LATE: readyToRunTime === 0 (synchronous readyToRun takes effect after pickAndRun).
const PHASE_EARLY = 0
const PHASE_LATE = 1

const EVENT_COMPLETE = 0
const EVENT_ABORT = 1
const EVENT_READY = 2
const EVENT_ADD = 3

type SimEvent = {
  time: number
  phase: number
  actionIndex: number
  type: number
}

/**
 * Reference implementation of PriorityQueue execution order.
 * Simulates the queue's event-driven scheduling to predict which actions
 * run and in what order.
 */
function calculateOrder(actions: Action[]): number[] {
  const actionsLen = actions.length
  const order: number[] = []
  let busy = false
  let nextOrder = 1

  // Mirrors Priority.branch: [insertionOrder, priority] or [insertionOrder] when priority is null
  const branches: (number[] | null)[] = new Array(actionsLen).fill(null)
  const isReady = new Uint8Array(actionsLen)
  const isActive = new Uint8Array(actionsLen)

  const events = buildEvents(actions)
  events.sort(compareEvents)

  let eventIndex = 0
  while (eventIndex < events.length) {
    const time = events[eventIndex].time

    while (
      eventIndex < events.length &&
      events[eventIndex].time === time &&
      events[eventIndex].phase === PHASE_EARLY
    ) {
      const event = events[eventIndex++]
      const actionIndex = event.actionIndex
      switch (event.type) {
        case EVENT_COMPLETE:
          busy = false
          break
        case EVENT_ABORT:
          isActive[actionIndex] = 0
          break
        case EVENT_READY:
          if (isActive[actionIndex]) {
            isReady[actionIndex] = 1
          }
          break
        case EVENT_ADD: {
          const action = actions[actionIndex]
          const insertionOrder = nextOrder++
          if (action.abortTime === 0) {
            break
          }
          branches[actionIndex] =
            action.priority != null
              ? [insertionOrder, action.priority]
              : [insertionOrder]
          isReady[actionIndex] = action.readyToRunTime == null ? 1 : 0
          isActive[actionIndex] = 1
          break
        }
      }
    }

    pickAndRun(time)

    while (eventIndex < events.length && events[eventIndex].time === time) {
      const event = events[eventIndex++]
      if (isActive[event.actionIndex]) {
        isReady[event.actionIndex] = 1
      }
    }

    pickAndRun(time)
  }

  return order

  function pickAndRun(time: number): void {
    while (!busy) {
      let best = -1
      for (let i = 0; i < actionsLen; i++) {
        if (!isActive[i] || !isReady[i]) {
          continue
        }
        if (best === -1 || branchLessThan(branches[i]!, branches[best]!)) {
          best = i
        }
      }
      if (best === -1) {
        break
      }

      isActive[best] = 0
      order.push(actions[best].id)

      const action = actions[best]
      if (action.duration > 0) {
        let completeTime = time + action.duration
        if (action.abortTime != null) {
          const abortFireTime = action.addTime + action.abortTime
          if (abortFireTime > time && abortFireTime <= completeTime) {
            completeTime = abortFireTime
          }
        }
        busy = true
        insertEvent(events, eventIndex, {
          time: completeTime,
          phase: PHASE_EARLY,
          actionIndex: best,
          type: EVENT_COMPLETE,
        })
      }
    }
  }
}

/** Mirrors priorityCompare: compares from highest level to lowest level */
function branchLessThan(a: number[], b: number[]): boolean {
  const lenA = a.length
  const lenB = b.length
  const len = lenA > lenB ? lenA : lenB
  for (let i = 0; i < len; i++) {
    const valueA = i >= lenA ? 0 : a[lenA - 1 - i]
    const valueB = i >= lenB ? 0 : b[lenB - 1 - i]
    if (valueA !== valueB) {
      return valueA < valueB
    }
  }
  return false
}

function buildEvents(actions: Action[]): SimEvent[] {
  const events: SimEvent[] = []
  for (let i = 0, len = actions.length; i < len; i++) {
    const action = actions[i]

    events.push({
      time: action.addTime,
      phase: PHASE_EARLY,
      actionIndex: i,
      type: EVENT_ADD,
    })

    if (action.abortTime != null && action.abortTime !== 0) {
      events.push({
        time: action.addTime + action.abortTime,
        phase: PHASE_EARLY,
        actionIndex: i,
        type: EVENT_ABORT,
      })
    }

    if (action.readyToRunTime != null) {
      events.push({
        time: action.addTime + action.readyToRunTime,
        phase: action.readyToRunTime === 0 ? PHASE_LATE : PHASE_EARLY,
        actionIndex: i,
        type: EVENT_READY,
      })
    }
  }
  return events
}

function compareEvents(a: SimEvent, b: SimEvent): number {
  if (a.time !== b.time) {
    return a.time > b.time ? 1 : -1
  }
  if (a.phase !== b.phase) {
    return a.phase > b.phase ? 1 : -1
  }
  return a.actionIndex > b.actionIndex
    ? 1
    : a.actionIndex < b.actionIndex
      ? -1
      : 0
}

// Binary search + element shifting instead of splice to avoid O(n) array reallocation
function insertEvent(
  events: SimEvent[],
  searchFrom: number,
  event: SimEvent,
): void {
  let lo = searchFrom
  let hi = events.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (compareEvents(events[mid], event) <= 0) {
      lo = mid + 1
    } else {
      hi = mid
    }
  }
  events.push(event)
  for (let i = events.length - 1; i > lo; i--) {
    events[i] = events[i - 1]
  }
  events[lo] = event
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

  const timeAdd: number = timeController.now()

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

  const timeEnd = timeController.now()

  checkActionResult(action, runResult, runError, timeAdd, timeStart, timeEnd)
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
  runResult: number | null,
  runError: TestError | AbortError | null,
  timeAdd: number,
  timeStart: number | null,
  timeEnd: number,
): void {
  const timeStartFromAdd = timeStart != null ? timeStart - timeAdd : null

  if (
    timeStartFromAdd != null &&
    timeStartFromAdd < (action.readyToRunTime ?? 0)
  ) {
    throw new Error(
      `[test] Action started before readyToRunTime, action: ${formatObject(
        action,
      )}, timeAdd: ${timeAdd}, timeStart: ${timeStart}, timeStartFromAdd: ${timeStartFromAdd}`,
    )
  }

  // null - unknown if should abort or not
  const shouldAbort =
    timeStartFromAdd == null ||
    (action.abortTime != null &&
      action.abortTime <= timeStartFromAdd + action.duration)
  const shouldAbortBeforeStart =
    timeStartFromAdd == null ||
    (action.abortTime != null && action.abortTime <= timeStartFromAdd)

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
    const durationActual = timeEnd - timeStart
    const durationExpected =
      action.abortTime == null
        ? action.duration
        : Math.max(
            0,
            Math.min(action.duration, action.abortTime - timeStartFromAdd!),
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
    assert.deepStrictEqual(
      orderActual,
      orderExpected,
      `Order actual !== expected:\n${formatObject({ actions, orderActual, orderExpected })}`,
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
      limitTests: 200_000,
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
        dir: 'tmp/test/PriorityQueue/variants',
        attemptsPerVariant: 10,
        useToFindBestError: true,
      },
    })
  })
})

/**
 * Logging: disabled by default, enabled only on error (test re-runs with log: true)
 *
 * General format:
 * - Log entries: bracket-path style with [test] prefix
 *
 * Entity naming:
 * - Chain nodes: c{chainIndex}_{nodeIndex}, e.g. c1_0, c1_1, c2_0
 *
 * Actions:
 * - emit - source emits a value
 * - update - source updates its value
 * - invalidate - source invalidates
 * - subscribe - subscribe to destination
 * - unsubscribe - unsubscribe from destination
 *
 * Parameters:
 * - type - node type: Derived or Subject
 * - async - whether node uses async propagation
 * - delay - delay in ms for async propagation
 * - value - emitted or updated value
 * - total - active subscriber count after subscribe/unsubscribe
 * - call - factory invocation counter
 * - values - values received by destination factory from each path
 *
 * Example trace:
 * [test] c1_0 type=Derived async=true delay=2
 * [test] c1_1 type=Subject async=false delay=0
 * [test] c2_0 type=Subject async=true delay=1
 * [test][0] subscribe total=1
 * [test][1] emit value=1
 * [test] factory call=1 values=[1, 1]
 * [test][2] emit value=2
 * [test] factory call=2 values=[2, 2]
 */
/* eslint-disable @typescript-eslint/no-wrapper-object-types */
import { describe, it } from 'vitest'
import { createTestVariants } from '@flemist/test-variants'
import {
  getRandomSeed,
  Random,
  randomBoolean,
  randomInt,
  randomItem,
} from 'src/common/random'
import type { Unsubscribe } from 'src/common/types/common'
import type { ActionOnCircular, IObservable } from './types'
import { Derived } from './Derived'
import { Subject } from './Subject'
import { TimeControllerMock } from '@flemist/time-controller'
import { AbortControllerFast } from '@flemist/abort-controller-fast'
import { waitTimeControllerMock } from 'src/common/async/wait/waitTimeControllerMock'
import { delay } from 'src/common/async/wait/delay'
import { EMPTY_FUNC } from 'src/common/constants'

const testVariants = createTestVariants(async (args: TestVariantsArgs) => {
  const rnd = new Random(args.seed)
  try {
    const context = generateContext({ rnd: rnd.clone(), args, log: false })
    await test({ rnd: rnd.clone(), context, args })
  } catch (err) {
    try {
      const context = generateContext({ rnd: rnd.clone(), args, log: true })
      await test({ rnd: rnd.clone(), context, args })
    } catch {
      // Ignore re-run error, throw original
    }
    throw err
  }
})

function generateContext(options: GenerateContextOptions): TestContext {
  const { rnd, args, log } = options
  const timeController = new TimeControllerMock()

  const source = new Subject<Value>({
    emitLastEvent: args.source_emitLastEvent,
    hasLast: args.source_hasLast,
    last: args.source_last,
    autoClear: args.source_autoClear,
  })

  const chain1Tail = buildChain({
    rnd: rnd.nextRandom(),
    source,
    length: args.chainLength1,
    isAsync: args.async,
    timeController,
    chainIndex: 1,
    log,
  })

  const chain2Tail = buildChain({
    rnd: rnd.nextRandom(),
    source,
    length: args.chainLength2,
    isAsync: args.async,
    timeController,
    chainIndex: 2,
    log,
  })

  let factoryCallCount = 0
  const destination = new Derived(
    [chain1Tail, chain2Tail],
    values => {
      factoryCallCount++
      if (log) {
        console.log(
          `[test] factory call=${factoryCallCount} values=[${String(values[0])}, ${String(values[1])}]`,
        )
      }
      if (values[0] !== values[1]) {
        throw new Error(
          `Consistency violation: factory received different values from two paths:` +
            ` chain1=${String(values[0])}, chain2=${String(values[1])}`,
        )
      }
      return values
    },
    {
      dontEmitLastEvent: !(args.dest_emitLastEvent ?? false),
      hasLast: args.dest_hasLast,
      last: args.dest_last,
      actionOnCircular: args.dest_actionOnCircular,
      dontAutoClear: !(args.dest_autoClear ?? false),
    },
  )

  return {
    log,
    source,
    destination,
    timeController,
  }
}

type BuildChainOptions = {
  rnd: Random
  source: IObservable<Value>
  length: number
  isAsync: boolean
  timeController: TimeControllerMock
  chainIndex: number
  log: boolean
}

function buildChain(options: BuildChainOptions): IObservable<Value> {
  const { rnd, source, length, isAsync, timeController, chainIndex, log } =
    options

  let current: IObservable<Value> = source

  for (let i = 0; i < length; i++) {
    const prev = current
    const useDerived = randomBoolean(rnd)
    const nodeIsAsync = isAsync && randomBoolean(rnd)
    const nodeDelay = nodeIsAsync ? randomInt(rnd, 0, 4) : 0

    if (log) {
      console.log(
        `[test] c${chainIndex}_${i} type=${useDerived ? 'Derived' : 'Subject'} async=${nodeIsAsync} delay=${nodeDelay}`,
      )
    }

    if (useDerived) {
      current = new Derived(
        [prev],
        nodeIsAsync
          ? (values: [Value], emit) => {
              const value = values[0]
              if (nodeDelay === 0) {
                emit(value)
                return EMPTY_FUNC
              }
              const abortController = new AbortControllerFast()
              delay(nodeDelay, abortController.signal, timeController)
                .then(() => {
                  emit(value)
                })
                .catch(EMPTY_FUNC)
              return () => {
                abortController.abort()
              }
            }
          : (values: [Value]): Value => values[0],
        {
          dontEmitLastEvent: false,
          dontAutoClear: false,
        },
      )
    } else {
      current = new Subject<Value>({
        emitLastEvent: true,
        autoClear: true,
        startStopNotifier: (emit, update, invalidate) => {
          let abortController: AbortControllerFast | null = null
          const unsubscribe = prev.subscribe(
            nodeIsAsync
              ? value => {
                  if (nodeDelay === 0) {
                    emit(value)
                    return
                  }
                  if (abortController) {
                    abortController.abort()
                  }
                  abortController = new AbortControllerFast()
                  delay(nodeDelay, abortController.signal, timeController)
                    .then(() => {
                      emit(value)
                    })
                    .catch(EMPTY_FUNC)
                }
              : emit,
            invalidate,
          )
          return () => {
            if (abortController) {
              abortController.abort()
              abortController = null
            }
            unsubscribe()
          }
        },
      })
    }
  }

  return current
}

async function test(options: TestOptions): Promise<void> {
  const { rnd, context, args } = options
  const { source, destination, timeController, log } = context

  type Action = 'invalidate' | 'update' | 'emit' | 'unsubscribe' | 'subscribe'
  const actions: Action[] = []
  for (let i = 0; i < args.invalidates; i++) {
    actions.push('invalidate')
  }
  for (let i = 0; i < args.updates; i++) {
    actions.push('update')
  }
  for (let i = 0; i < args.emits; i++) {
    actions.push('emit')
  }
  for (let i = 0; i < args.unsubscribes; i++) {
    actions.push('unsubscribe')
  }
  for (let i = 0; i < args.subscribes; i++) {
    actions.push('subscribe')
  }

  const unsubscribes: Unsubscribe[] = []
  let activeSubscribes = 0

  for (let i = 0, len = args.actionsCount; i < len; i++) {
    if (actions.length === 0) {
      break
    }
    const action = randomItem(rnd, actions)

    switch (action) {
      case 'emit': {
        const value = randomItem(rnd, args.values)
        if (log) {
          console.log(`[test][${i}] emit value=${String(value)}`)
        }
        source.emit(value)
        if (args.async && randomBoolean(rnd)) {
          await waitTimeControllerMock(timeController)
        }
        break
      }
      case 'update': {
        if (source.emitLast) {
          const value = randomItem(rnd, args.values)
          if (log) {
            console.log(`[test][${i}] update value=${String(value)}`)
          }
          source.update(() => value)
          if (args.async && randomBoolean(rnd)) {
            await waitTimeControllerMock(timeController)
          }
        }
        break
      }
      case 'invalidate': {
        if (log) {
          console.log(`[test][${i}] invalidate`)
        }
        source.invalidate()
        break
      }
      case 'subscribe': {
        const unsubscribe = destination.subscribe(
          () => {},
          () => {},
        )
        unsubscribes.push(unsubscribe)
        activeSubscribes++
        if (log) {
          console.log(`[test][${i}] subscribe total=${activeSubscribes}`)
        }
        if (args.async && randomBoolean(rnd)) {
          await waitTimeControllerMock(timeController)
        }
        break
      }
      case 'unsubscribe': {
        if (unsubscribes.length > 0) {
          const unsubscribe = randomItem(rnd, unsubscribes, true)
          unsubscribe()
          activeSubscribes--
          if (log) {
            console.log(`[test][${i}] unsubscribe total=${activeSubscribes}`)
          }
        }
        break
      }
      default:
        throw new Error(`Unknown action: ${action}`)
    }
  }

  for (let i = 0, len = unsubscribes.length; i < len; i++) {
    unsubscribes[i]()
  }
}

type TestVariantsArgs = {
  seed: number

  source_emitLastEvent: boolean | null | undefined
  source_hasLast: boolean | null | undefined
  source_last: Value
  source_autoClear: boolean | null | undefined

  dest_emitLastEvent: boolean | null | undefined
  dest_hasLast: boolean | null | undefined
  dest_last: Value[] | undefined
  dest_actionOnCircular: ActionOnCircular | null | undefined
  dest_autoClear: boolean | null | undefined

  chainLength1: number
  chainLength2: number
  async: boolean
  actionsCount: number

  invalidates: number
  updates: number
  emits: number
  unsubscribes: number
  subscribes: number

  values: Value[]
}

type GenerateContextOptions = {
  rnd: Random
  args: TestVariantsArgs
  log: boolean
}

type TestContext = {
  log: boolean
  source: Subject<Value>
  destination: Derived<[IObservable<Value>, IObservable<Value>], Value[]>
  timeController: TimeControllerMock
}

type TestOptions = {
  rnd: Random
  context: TestContext
  args: TestVariantsArgs
}

type Value = number | Number | null | undefined

describe('Derived consistency', { timeout: 7 * 60 * 60 * 1000 }, () => {
  it('variants', async () => {
    await testVariants({
      source_emitLastEvent: [undefined, null, false, true],
      source_hasLast: [undefined, null, false, true],
      source_last: [undefined, null, 0, 1, new Number(0), new Number(1)],
      source_autoClear: [undefined, null, false, true],

      dest_emitLastEvent: [undefined, null, false, true],
      dest_hasLast: [undefined, null, false, true],
      dest_last: [
        undefined,
        [0],
        [1],
        [new Number(0)],
        [new Number(1)],
        [0, new Number(1)],
      ],
      dest_actionOnCircular: [undefined, null, 'throw', 'emitLast'],
      dest_autoClear: [undefined, null, false, true],

      chainLength1: Array.from({ length: 10 }, (_, i) => i),
      chainLength2: Array.from({ length: 10 }, (_, i) => i),
      async: [false, true],
      actionsCount: Array.from({ length: 50 }, (_, i) => i),

      invalidates: Array.from({ length: 3 }, (_, i) => i),
      updates: Array.from({ length: 3 }, (_, i) => i),
      emits: Array.from({ length: 3 }, (_, i) => i),
      unsubscribes: Array.from({ length: 3 }, (_, i) => i),
      subscribes: Array.from({ length: 3 }, (_, i) => i),

      values: [
        [
          undefined,
          null,
          ...Array.from({ length: 100 }, (_, i) => i),
          ...Array.from({ length: 100 }, (_, i) => new Number(i)),
        ],
      ],
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
        dir: 'tmp/test/Derived.consistency/variants',
        attemptsPerVariant: 10,
        useToFindBestError: false,
      },
    })
  })
})

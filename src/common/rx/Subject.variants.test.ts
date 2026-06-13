/* eslint-disable @typescript-eslint/no-wrapper-object-types */
import { describe, it } from 'vitest'
import { createTestVariants } from '@flemist/test-variants'
import {
  arrayShuffle,
  getRandomSeed,
  Random,
  randomItem,
} from 'src/common/random'
import type { Unsubscribe } from 'src/common/types/common'
import type { ActionOnCircular, Invalidate, Listener } from './types'
import { Subject } from './Subject'

type Value = number | Number | null | undefined

export type TestVariantsArgs = {
  seed: number

  source_emitLastEvent: boolean | null | undefined
  source_hasLast: boolean | null | undefined
  source_last: Value
  source_autoClear: boolean | null | undefined

  dest_emitLastEvent: boolean | null | undefined
  dest_startStopNotifier: boolean
  dest_hasLast: boolean | null | undefined
  dest_last: Value
  dest_actionOnCircular: ActionOnCircular | null | undefined
  dest_autoClear: boolean | null | undefined

  invalidates: number
  updates: number
  emits: number
  unsubscribes: number
  subscribes: number

  values: Value[]
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

function generateContext(options: GenerateContextOptions): TestContext {
  const { rnd, args, log } = options

  const source = new Subject<Value>({
    emitLastEvent: args.source_emitLastEvent,
    hasLast: args.source_hasLast,
    last: args.source_last,
    autoClear: args.source_autoClear,
  })

  const dest = new Subject<Value>({
    emitLastEvent: args.dest_emitLastEvent,
    startStopNotifier: args.dest_startStopNotifier
      ? (emit, update, invalidate) => {
          return source.subscribe(emit, invalidate)
        }
      : null,
    hasLast: args.dest_hasLast,
    last: args.dest_last,
    actionOnCircular: args.dest_actionOnCircular,
    autoClear: args.dest_autoClear,
  })

  let subscribes = 0
  let sourceUnsubscribe: null | Unsubscribe = null

  return {
    source,
    dest,
    subscribe(
      listener: Listener<Value>,
      invalidate?: null | Invalidate,
    ): Unsubscribe {
      subscribes++
      if (subscribes === 1 && !args.dest_startStopNotifier) {
        sourceUnsubscribe = source.subscribe(
          value => {
            dest.emit(value)
          },
          () => {
            dest.invalidate()
          },
        )
      }
      const unsubscribe = dest.subscribe(listener, invalidate)
      return () => {
        unsubscribe()
        subscribes--
        if (subscribes === 0 && !args.dest_startStopNotifier) {
          sourceUnsubscribe!()
          sourceUnsubscribe = null
        }
      }
    },
  }
}

type TestContext = {
  source: Subject<Value>
  dest: Subject<Value>
  subscribe(
    listener: Listener<Value>,
    invalidate?: null | Invalidate,
  ): Unsubscribe
}

type TestOptions = {
  rnd: Random
  context: TestContext
  args: TestVariantsArgs
}

function test(options: TestOptions): void {
  const { rnd, context, args } = options
  const { source, dest, subscribe } = context

  type Event = 'invalidate' | Value
  const events: Event[] = []
  const unsubscribe = subscribe(
    o => {
      events.push(o)
    },
    () => {
      events.push('invalidate')
    },
  )

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
  arrayShuffle(rnd, actions)

  let lastActionIndex: number | null = null
  let lastUpdateValue: Value | null = null

  function randomValue(): Value {
    return randomItem(rnd, args.values)
  }

  const unsubscribes: Unsubscribe[] = []

  function doAction(action: Action, index: number): void {
    lastActionIndex = index
    switch (action) {
      case 'invalidate':
        source.invalidate()
        break
      case 'update':
        if (source.emitLast) {
          source.update(value => {
            lastUpdateValue = value
            return randomValue()
          })
        }
        break
      case 'emit':
        source.emit(randomValue())
        break
      case 'unsubscribe':
        if (unsubscribes.length > 0) {
          const unsubscribe = randomItem(rnd, unsubscribes, true)
          unsubscribe()
        }
        break
      case 'subscribe': {
        const unsubscribe = subscribe(
          o => {
            events.push(o)
          },
          () => {
            events.push('invalidate')
          },
        )
        unsubscribes.push(unsubscribe)
        break
      }
      default:
        throw new Error(`Unknown action: ${action}`)
    }
  }

  function check(): void {
    // TODO: check all invariants based on current state
  }

  function doActionAndCheck(action: Action, index: number): void {
    doAction(action, index)
    check()
  }

  actions.forEach(doActionAndCheck)
}

describe('Subject', { timeout: 7 * 60 * 60 * 1000 }, () => {
  it('variants', async () => {
    await testVariants({
      source_emitLastEvent: [undefined, null, false, true],
      source_hasLast: [undefined, null, false, true],
      source_last: [undefined, null, 0, 1, new Number(0), new Number(1)],
      source_autoClear: [undefined, null, false, true],

      dest_emitLastEvent: [undefined, null, false, true],
      dest_startStopNotifier: [false, true],
      dest_hasLast: [undefined, null, false, true],
      dest_last: [undefined, null, 0, 1, new Number(0), new Number(1)],
      dest_actionOnCircular: [undefined, null, 'throw', 'emitLast'],
      dest_autoClear: [undefined, null, false, true],

      invalidates: Array.from({ length: 3 }, (_, i) => i),
      updates: Array.from({ length: 3 }, (_, i) => i),
      emits: Array.from({ length: 3 }, (_, i) => i),
      unsubscribes: Array.from({ length: 3 }, (_, i) => i),
      subscribes: Array.from({ length: 3 }, (_, i) => i),

      values: [[undefined, null, 0, 1, new Number(0), new Number(1)]],
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
        dir: 'tmp/test/Subject/variants',
        attemptsPerVariant: 10,
        useToFindBestError: false,
      },
    })
  })
})

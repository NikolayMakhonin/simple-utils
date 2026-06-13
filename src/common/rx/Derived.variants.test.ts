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
import type {
  ActionOnCircular,
  Emit,
  Invalidate,
  Update,
  Updater,
} from './types'
import { Derived } from './Derived'
import { Subject } from './Subject'

type Value = number | Number | null | undefined

export type TestVariantsArgs = {
  seed: number

  actionsCount: number
  sources: 0 | 1 | 2

  source1_emitLastEvent: boolean | null | undefined
  source1_hasLast: boolean | null | undefined
  source1_last: Value
  source1_autoClear: boolean | null | undefined

  source2_emitLastEvent: boolean | null | undefined
  source2_hasLast: boolean | null | undefined
  source2_last: Value
  source2_autoClear: boolean | null | undefined

  derived_emitLastEvent: boolean | null | undefined
  derived_hasLast: boolean | null | undefined
  derived_last: Value[] | undefined
  derived_actionOnCircular: ActionOnCircular | null | undefined
  derived_autoClear: boolean | null | undefined
  async: boolean

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
  const { args, log } = options

  const sources: Subject<Value>[] = []

  if (args.sources >= 1) {
    const source = new Subject<Value>({
      emitLastEvent: args.source1_emitLastEvent,
      hasLast: args.source1_hasLast,
      last: args.source1_last,
      autoClear: args.source1_autoClear,
    })
    sources.push(source)
  }

  if (args.sources >= 2) {
    const source = new Subject<Value>({
      emitLastEvent: args.source2_emitLastEvent,
      hasLast: args.source2_hasLast,
      last: args.source2_last,
      autoClear: args.source2_autoClear,
    })
    sources.push(source)
  }

  const func = args.async ? funcAsync : funcSync

  const derived = new Derived(sources, func, {
    dontEmitLastEvent: !(args.derived_emitLastEvent ?? false),
    hasLast: args.derived_hasLast,
    last: args.derived_last,
    actionOnCircular: args.derived_actionOnCircular,
    dontAutoClear: !(args.derived_autoClear ?? false),
  })

  function funcSync(values: Value[]): Value[] {
    return values
  }

  let funcAsyncEmit: Emit<Value[]> | null = null
  let funcAsyncUpdate: Update<Value[]> | null = null
  let funcAsyncInvalidate: Invalidate | null = null
  let funcAsyncSubscribed = false
  let onFuncAsyncCalled: (values: Value[]) => void = null!

  function funcAsync(
    values: Value[],
    emit: Emit<Value[]>,
    update: Update<Value[]>,
    invalidate: Invalidate,
  ): Unsubscribe | void {
    if (funcAsyncEmit || funcAsyncUpdate || funcAsyncInvalidate) {
      throw new Error('funcAsync is already running')
    }
    funcAsyncEmit = emit
    funcAsyncUpdate = update
    funcAsyncInvalidate = invalidate
    onFuncAsyncCalled(values)
    funcAsyncSubscribed = true
    return () => {
      funcAsyncEmit = null
      funcAsyncUpdate = null
      funcAsyncInvalidate = null
      funcAsyncSubscribed = false
    }
  }

  return {
    sources,
    derived,
    setOnFuncAsyncCalled: (onCalled: (values: Value[]) => void) => {
      onFuncAsyncCalled = onCalled
    },
    funcAsyncEmit: (values: Value[]): boolean => {
      if (!funcAsyncEmit) {
        return false
      }
      funcAsyncEmit(values)
      return true
    },
    funcAsyncUpdate: (update: Updater<Value[]>): boolean => {
      if (!funcAsyncUpdate) {
        return false
      }
      funcAsyncUpdate(update)
      return true
    },
    funcAsyncInvalidate: () => {
      if (!funcAsyncInvalidate) {
        return
      }
      funcAsyncInvalidate()
    },
  }
}

type TestContext = {
  sources: Subject<Value>[]
  derived: Derived<Value[], Value[]>
  setOnFuncAsyncCalled: (onCalled: (values: Value[]) => void) => void
  funcAsyncEmit: (values: Value[]) => boolean
  funcAsyncUpdate: (update: Updater<Value[]>) => boolean
  funcAsyncInvalidate: () => void
}

type TestOptions = {
  rnd: Random
  context: TestContext
  args: TestVariantsArgs
}

function test(options: TestOptions): void {
  const { rnd, context, args } = options
  const {
    sources,
    derived,
    setOnFuncAsyncCalled,
    funcAsyncEmit,
    funcAsyncUpdate,
    funcAsyncInvalidate,
  } = context

  const sourceArgs = [
    {
      emitLast: args.source1_emitLastEvent ?? false,
      hasLast: args.source1_hasLast ?? false,
      last: args.source1_last as Value,
      autoClear: args.source1_autoClear ?? false,
    },
    {
      emitLast: args.source2_emitLastEvent ?? false,
      hasLast: args.source2_hasLast ?? false,
      last: args.source2_last as Value,
      autoClear: args.source2_autoClear ?? false,
    },
  ]
  const expectedSources = sources.map((_, i) => ({
    hasLast: sourceArgs[i].hasLast,
    last: sourceArgs[i].last,
  }))

  let activeSubscribes = 0

  type ActionFuncAsync =
    | 'funcAsyncInvalidate'
    | 'funcAsyncUpdate'
    | 'funcAsyncEmit'
  type Action =
    | 'invalidate'
    | 'update'
    | 'emit'
    | 'unsubscribe'
    | 'subscribe'
    | ActionFuncAsync
  const actions: Action[] = []
  for (let i = 0; i < args.invalidates; i++) {
    actions.push('invalidate')
    actions.push('funcAsyncInvalidate')
  }
  for (let i = 0; i < args.emits; i++) {
    actions.push('emit')
    actions.push('funcAsyncEmit')
  }
  for (let i = 0; i < args.updates; i++) {
    actions.push('update')
    actions.push('funcAsyncUpdate')
  }
  for (let i = 0; i < args.unsubscribes; i++) {
    actions.push('unsubscribe')
  }
  for (let i = 0; i < args.subscribes; i++) {
    actions.push('subscribe')
  }
  const actionsFuncAsync: ActionFuncAsync[] = actions.filter(
    (action): action is ActionFuncAsync =>
      action === 'funcAsyncInvalidate' ||
      action === 'funcAsyncUpdate' ||
      action === 'funcAsyncEmit',
  )

  let lastUpdateValue: Value[] | null = null
  let lastSourceValues: Value[] | null = null

  const derivedEmitLast = args.derived_emitLastEvent ?? false
  const derivedAutoClear = args.derived_autoClear ?? false
  let expectedDerivedHasLast = args.derived_hasLast ?? false
  let expectedDerivedLast: Value[] | undefined = args.derived_last

  function derivedEmitted(value: Value[]): void {
    if (derivedEmitLast) {
      expectedDerivedHasLast = true
      expectedDerivedLast = value
    }
  }

  type Event = 'invalidate' | Value[]
  const events: Event[] = []
  const unsubscribes: Unsubscribe[] = []

  setOnFuncAsyncCalled(values => {
    lastSourceValues = values
    if (randomBoolean(rnd)) {
      doActions(randomInt(rnd, 1, 5), true)
      check()
    }
  })

  function sourceEmitted(sourceIndex: number, value: Value): void {
    if (sourceArgs[sourceIndex].emitLast) {
      expectedSources[sourceIndex].hasLast = true
      expectedSources[sourceIndex].last = value
    }
  }

  function doAction(action: Action): void {
    switch (action) {
      case 'invalidate':
        if (sources.length > 0) {
          const source = randomItem(rnd, sources)
          source.invalidate()
        }
        break
      case 'update':
        if (sources.length > 0) {
          const sourceIndex = randomInt(rnd, 0, sources.length)
          const source = sources[sourceIndex]
          if (source.emitLast) {
            const value = randomItem(rnd, args.values)
            const expectedLast = expectedSources[sourceIndex].last
            source.update(last => {
              if (last !== expectedLast) {
                throw new Error(
                  `sources[${sourceIndex}] update last: ${String(last)} !== ${String(expectedLast)}`,
                )
              }
              return value
            })
            sourceEmitted(sourceIndex, value)
          }
        }
        break
      case 'emit':
        if (sources.length > 0) {
          const sourceIndex = randomInt(rnd, 0, sources.length)
          const source = sources[sourceIndex]
          const value = randomItem(rnd, args.values)
          source.emit(value)
          sourceEmitted(sourceIndex, value)
        }
        break
      case 'funcAsyncInvalidate':
        if (funcAsyncInvalidate) {
          funcAsyncInvalidate()
        }
        break
      case 'funcAsyncUpdate':
        if (derivedEmitLast) {
          const emitted = funcAsyncUpdate(values => {
            lastUpdateValue = values
            if (lastUpdateValue !== expectedDerivedLast) {
              throw new Error(
                `funcAsyncUpdate last: ${String(lastUpdateValue)}` +
                  ` !== ${String(expectedDerivedLast)}`,
              )
            }
            return values
          })
          if (emitted) {
            derivedEmitted(lastUpdateValue!)
          }
        }
        break
      case 'funcAsyncEmit':
        if (lastSourceValues) {
          const emitted = funcAsyncEmit(lastSourceValues)
          if (emitted) {
            derivedEmitted(lastSourceValues)
          }
        }
        break
      case 'unsubscribe':
        if (unsubscribes.length > 0) {
          const unsubscribe = randomItem(rnd, unsubscribes, true)
          unsubscribe()
          activeSubscribes--
          if (activeSubscribes === 0) {
            for (let i = 0; i < sources.length; i++) {
              if (sourceArgs[i].autoClear) {
                expectedSources[i].hasLast = false
                expectedSources[i].last = undefined
              }
            }
            if (derivedAutoClear) {
              expectedDerivedHasLast = false
              expectedDerivedLast = undefined
            }
          }
        }
        break
      case 'subscribe': {
        const isFirst = activeSubscribes === 0
        activeSubscribes++
        const syncEvents: Event[] = []
        let subscribing = true
        const unsubscribe = derived.subscribe(
          o => {
            if (subscribing) {
              syncEvents.push(o)
            }
            events.push(o)
          },
          () => {
            if (subscribing) {
              syncEvents.push('invalidate')
            }
            events.push('invalidate')
          },
        )
        subscribing = false
        // A non-first subscriber never restarts the source subscription, so the
        // only synchronous delivery is the derived stored last value; this makes
        // the subscribe call a clean probe of the derived hasLast/last state
        // Sync func emits on every source delivery without going through the test
        // harness, so the derived last model is tracked exclusively in async mode
        if (!isFirst && args.async) {
          const valueEvents = syncEvents.filter(o => o !== 'invalidate')
          if (expectedDerivedHasLast) {
            if (valueEvents.length !== 1) {
              throw new Error(
                `derived subscribe delivered ${valueEvents.length} values,` +
                  ` expected 1 (hasLast)`,
              )
            }
            if (valueEvents[0] !== expectedDerivedLast) {
              throw new Error(
                `derived last: ${String(valueEvents[0])}` +
                  ` !== ${String(expectedDerivedLast)}`,
              )
            }
          } else if (valueEvents.length !== 0) {
            throw new Error(
              `derived subscribe delivered ${valueEvents.length} values,` +
                ` expected 0 (no hasLast)`,
            )
          }
        }
        unsubscribes.push(unsubscribe)
        break
      }
      default:
        throw new Error(`Unknown action: ${action}`)
    }
  }

  function doActions(count: number, funcAsyncOnly?: boolean): void {
    const availableActions = funcAsyncOnly ? actionsFuncAsync : actions
    for (let i = 0; i < count; i++) {
      const action = randomItem(rnd, availableActions)
      doAction(action)
    }
  }

  function check(): void {
    for (let i = 0; i < sources.length; i++) {
      const source = sources[i]
      const expected = expectedSources[i]
      if (source.emitLast !== sourceArgs[i].emitLast) {
        throw new Error(
          `sources[${i}].emitLast: ${source.emitLast} !== ${sourceArgs[i].emitLast}`,
        )
      }
      if (source.hasLast !== expected.hasLast) {
        throw new Error(
          `sources[${i}].hasLast: ${source.hasLast} !== ${expected.hasLast}`,
        )
      }
      if (source.last !== expected.last) {
        throw new Error(
          `sources[${i}].last: ${String(source.last)} !== ${String(expected.last)}`,
        )
      }
      if (source.hasListeners !== activeSubscribes > 0) {
        throw new Error(
          `sources[${i}].hasListeners: ${source.hasListeners} !== ${activeSubscribes > 0}`,
        )
      }
    }
  }

  check()
  for (let i = 0, len = args.actionsCount; i < len; i++) {
    doActions(1)
    check()
  }
}

describe('Derived', { timeout: 7 * 60 * 60 * 1000 }, () => {
  it('variants', async () => {
    await testVariants({
      actionsCount: Array.from({ length: 50 }, (_, i) => i),

      sources: [0, 1, 2],

      source1_emitLastEvent: [undefined, null, false, true],
      source1_hasLast: [undefined, null, false, true],
      source1_last: [undefined, null, 0, 1, new Number(0), new Number(1)],
      source1_autoClear: [undefined, null, false, true],

      source2_emitLastEvent: [undefined, null, false, true],
      source2_hasLast: [undefined, null, false, true],
      source2_last: [undefined, null, 0, 1, new Number(0), new Number(1)],
      source2_autoClear: [undefined, null, false, true],

      derived_emitLastEvent: [undefined, null, false, true],
      derived_hasLast: [undefined, null, false, true],
      derived_last: [
        undefined,
        [0],
        [1],
        [new Number(0)],
        [new Number(1)],
        [0, new Number(1)],
      ],
      derived_actionOnCircular: [undefined, null, 'throw', 'emitLast'],
      derived_autoClear: [undefined, null, false, true],
      async: [false, true],

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
        dir: 'tmp/test/Derived/variants',
        attemptsPerVariant: 10,
        useToFindBestError: false,
      },
    })
  })
})

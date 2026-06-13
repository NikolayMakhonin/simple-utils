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
    funcAsyncEmit: (values: Value[]) => {
      if (!funcAsyncEmit) {
        return
      }
      funcAsyncEmit(values)
    },
    funcAsyncUpdate: (update: Updater<Value[]>) => {
      if (!funcAsyncUpdate) {
        return
      }
      funcAsyncUpdate(update)
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
  funcAsyncEmit: (values: Value[]) => void
  funcAsyncUpdate: (update: Updater<Value[]>) => void
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

  const lastActionIndex: number | null = null
  let lastUpdateValue: Value[] | null = null
  let lastSourceValues: Value[] | null = null

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
          const source = randomItem(rnd, sources)
          if (source.emitLast) {
            source.update(() => {
              return randomItem(rnd, args.values)
            })
          }
        }
        break
      case 'emit':
        if (sources.length > 0) {
          const source = randomItem(rnd, sources)
          source.emit(randomItem(rnd, args.values))
        }
        break
      case 'funcAsyncInvalidate':
        if (funcAsyncInvalidate) {
          funcAsyncInvalidate()
        }
        break
      case 'funcAsyncUpdate':
        if (funcAsyncUpdate && args.derived_emitLastEvent) {
          funcAsyncUpdate(values => {
            lastUpdateValue = values
            return values
          })
        }
        break
      case 'funcAsyncEmit':
        if (lastSourceValues) {
          funcAsyncEmit(lastSourceValues)
        }
        break
      case 'unsubscribe':
        if (unsubscribes.length > 0) {
          const unsubscribe = randomItem(rnd, unsubscribes, true)
          unsubscribe()
        }
        break
      case 'subscribe': {
        const unsubscribe = derived.subscribe(
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

  function doActions(count: number, funcAsyncOnly?: boolean): void {
    const availableActions = funcAsyncOnly ? actionsFuncAsync : actions
    for (let i = 0; i < count; i++) {
      const action = randomItem(rnd, availableActions)
      doAction(action)
    }
  }

  function check(): void {
    // TODO: check all invariants based on current state
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

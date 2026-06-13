import type {
  ActionOnCircular,
  Emit,
  Invalidate,
  IObservable,
  Listener,
  Stores,
  StoresValues,
  Update,
} from './types'
import type { Unsubscribe } from 'src/common/types/common'
import { Subject } from './Subject'
import { isObservable } from './helpers'

/** Must be pure */
export type DerivedFuncSync<S extends Stores, T> = (
  values: StoresValues<S>,
) => T

export type DerivedFuncAsync<S extends Stores, T> = (
  values: StoresValues<S>,
  emit: Emit<T>,
  update: Update<T>,
  invalidate: Invalidate,
) => Unsubscribe | void

export type DerivedOptions<T> = {
  /** Does not auto-clear state when the last subscriber unsubscribes */
  dontAutoClear?: null | boolean
  dontEmitLastEvent?: null | boolean
  hasLast?: null | boolean
  last?: T
  /** Action to perform on circular subscription or emission. Default is 'throw' */
  actionOnCircular?: null | ActionOnCircular
}

export type DerivedFunc<S extends Stores, T> =
  | DerivedFuncSync<S, T>
  | DerivedFuncAsync<S, T>

function startStopNotifier<S extends Stores, T>(
  sources: S,
  func: DerivedFunc<S, T>,
  emit: Emit<T>,
  update: Update<T>,
  invalidate: Invalidate,
) {
  const values: StoresValues<S> = [] as any
  const isPending: boolean[] = []
  let pendingCount = 0
  let isStarted = false
  const unsubscribes: Unsubscribe[] = []

  function run() {
    if (func.length > 1) {
      const unsubscribe = (func as DerivedFuncAsync<S, T>)(
        values,
        emit,
        update,
        invalidate,
      )
      if (unsubscribe) {
        unsubscribes.push(unsubscribe)
      }
    } else {
      const result = (func as DerivedFuncSync<S, T>)(values)
      emit(result)
    }
  }

  sources.forEach((source, index) => {
    if (!isObservable(source)) {
      values[index] = source
      return
    }
    // An observable source is pending until its first delivery,
    // so the computation never runs from a source that delivered nothing
    isPending[index] = true
    pendingCount++
    unsubscribes.push(
      source.subscribe(
        value => {
          values[index] = value
          if (isPending[index]) {
            isPending[index] = false
            pendingCount--
          }
          if (isStarted && pendingCount === 0) {
            run()
          }
        },
        () => {
          if (!isPending[index]) {
            isPending[index] = true
            pendingCount++
            if (pendingCount === 1) {
              invalidate()
            }
          }
        },
      ),
    )
  })

  isStarted = true
  if (pendingCount === 0) {
    run()
  } else {
    invalidate()
  }

  return () => {
    unsubscribes.forEach(o => o())
    unsubscribes.length = 0
  }
}

/**
 * Computes a value from sources on every source emission
 * Glitch-free: a single upstream change never produces a computation from mixed source generations
 * Computes and emits value exclusively when all sources have delivered at least once and not are in invalid state
 * Emits every computed value, including values equal to the previous one
 * Subscribes to sources exclusively while it has subscribers
 * Auto clears state when the last subscriber unsubscribes by default
 */
export class Derived<S extends Stores, T> implements IObservable<T> {
  readonly #subject: Subject<T>

  constructor(
    sources: S,
    func: DerivedFunc<S, T>,
    options?: null | DerivedOptions<T>,
  ) {
    this.#subject = new Subject<T>({
      emitLastEvent: !(options?.dontEmitLastEvent ?? false),
      hasLast: options?.hasLast,
      last: options?.last,
      actionOnCircular: options?.actionOnCircular,
      autoClear: !(options?.dontAutoClear ?? false),
      startStopNotifier: (emit, update, invalidate) =>
        startStopNotifier(sources, func, emit, update, invalidate),
    })
  }

  subscribe(
    listener: Listener<T>,
    invalidate?: null | Invalidate,
  ): Unsubscribe {
    return this.#subject.subscribe(listener, invalidate)
  }
}

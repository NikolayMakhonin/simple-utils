import type {
  ActionOnCircular,
  DerivedFunc,
  DerivedFuncAsync,
  DerivedFuncSync,
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

export type DerivedOptions<T> = {
  /** Does not auto-clear state when the last subscriber unsubscribes */
  dontAutoClear?: null | boolean
  dontEmitLastEvent?: null | boolean
  hasLast?: null | boolean
  last?: T
  /** Action to perform on circular subscription or emission. Default is 'throw' */
  actionOnCircular?: null | ActionOnCircular
}

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
  let unsubscribes: Unsubscribe[] = []
  let unsubscribed = false

  let asyncUnsubscribe: Unsubscribe | null = null
  let isRunning = false
  let hasPendingRun = false

  // func must never start while a previous runCore is still on the stack;
  // runCore can re-enter run through a synchronous source delivery caused by
  // func emitting, by a listener re-emitting a source, or by disposing the
  // previous async subscription; such a re-entrant run is deferred through
  // hasPendingRun and applied once, with the newest source values, after the
  // current runCore returns
  function run() {
    // Teardown sets unsubscribed; drop the run instead of starting func
    // during or after teardown
    if (unsubscribed) {
      return
    }
    if (isRunning) {
      hasPendingRun = true
      return
    }
    isRunning = true
    try {
      do {
        hasPendingRun = false
        runCore()
      } while (
        hasPendingRun &&
        // A source invalidated during runCore makes the deferred run subject
        // to the same precondition as the immediate path: run exclusively
        // when every source is fresh; the next source delivery resumes it
        pendingCount === 0 &&
        // Teardown sets unsubscribed; never re-run during or after teardown
        !unsubscribed
      )
    } finally {
      isRunning = false
    }
  }

  function runCore() {
    if (func.length > 1) {
      if (asyncUnsubscribe != null) {
        const prevUnsubscribe = asyncUnsubscribe
        asyncUnsubscribe = null
        prevUnsubscribe()
      }
      if (unsubscribed) {
        return
      }
      const unsubscribe = (func as DerivedFuncAsync<S, T>)(
        values,
        emit,
        update,
        invalidate,
      )
      if (unsubscribe != null) {
        // Teardown sets unsubscribed before func returns when the last
        // listener unsubscribed during func's synchronous emit; dispose this
        // cleanup instead of storing it so no live async subscription
        // survives teardown
        if (unsubscribed) {
          unsubscribe()
        } else {
          asyncUnsubscribe = unsubscribe
        }
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
          }
          invalidate()
          if (asyncUnsubscribe != null) {
            const prevUnsubscribe = asyncUnsubscribe
            asyncUnsubscribe = null
            prevUnsubscribe()
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
    if (unsubscribed) {
      return
    }
    unsubscribed = true
    const prevUnsubscribes = unsubscribes
    const prevUnsubscribe = asyncUnsubscribe
    unsubscribes = null!
    asyncUnsubscribe = null
    prevUnsubscribes.forEach(o => o())
    prevUnsubscribe?.()
  }
}

/**
 * Computes a value from sources on every source emission
 * Glitch-free: a single upstream change never produces a computation from mixed source generations
 * Computes and emits value exclusively when all sources have delivered at least once and are not in an invalid state
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

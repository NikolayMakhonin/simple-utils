import type {
  Invalidate,
  IObservable,
  Listener,
  Stores,
  StoresValues,
} from './types'
import type { Unsubscribe } from 'src/common/types/common'
import { Subject } from './Subject'
import { isObservable } from './helpers'

/**
 * Must be pure
 * The values array is reused between computations
 */
export type DerivedFunc<S extends Stores, T> = (values: StoresValues<S>) => T

/**
 * Computes a value from sources on every source emission
 * Defers computation while any source is stale, so a single upstream change
 * never computes from a mix of updated and stale source values
 * Relays invalidation to subscribers when the first source becomes stale
 * Emits every computed value, including values equal to the previous one
 * Subscribes to sources only while it has subscribers
 * Sources without a current value contribute undefined until their first emission
 */
export class Derived<S extends Stores, T> implements IObservable<T> {
  readonly #subject: Subject<T>

  constructor(sources: S, func: DerivedFunc<S, T>) {
    this.#subject = new Subject<T>({
      emitLastEvent: true,
      actionOnCycle: 'throw',
      startStopNotifier: emit => {
        const values: StoresValues<S> = [] as any
        const pendings: boolean[] = []
        let pendingCount = 0
        let isStarted = false
        const unsubscribes: Unsubscribe[] = []

        sources.forEach((source, index) => {
          if (!isObservable(source)) {
            values[index] = source
            return
          }
          unsubscribes.push(
            source.subscribe(
              value => {
                values[index] = value
                if (pendings[index]) {
                  pendings[index] = false
                  pendingCount--
                }
                if (isStarted && pendingCount === 0) {
                  emit(func(values))
                }
              },
              () => {
                if (!pendings[index]) {
                  pendings[index] = true
                  pendingCount++
                  if (pendingCount === 1) {
                    this.#subject.invalidate()
                  }
                }
              },
            ),
          )
        })

        isStarted = true
        if (pendingCount === 0) {
          emit(func(values))
        }

        return () => {
          unsubscribes.forEach(o => o())
          unsubscribes.length = 0
        }
      },
    })
  }

  subscribe(
    listener: Listener<T>,
    invalidate?: null | Invalidate,
  ): Unsubscribe {
    return this.#subject.subscribe(listener, invalidate)
  }
}

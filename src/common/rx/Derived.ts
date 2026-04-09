import type {
  IObservable,
  ISubject,
  Listener,
  Stores,
  StoresValues,
} from './types'
import type { Unsubscribe } from 'src/common/types/common'
import { type Emit, Subject } from './Subject'

export type DerivedFunc<S extends Stores, T> = (
  values: StoresValues<S>,
  emit: Emit<T>,
  update: (updater: (event: T) => T) => void,
) => T | Unsubscribe

/** @deprecated Incompleted, use svelte derived instead */
export class Derived<S extends Stores, T> implements IObservable<T> {
  private readonly _source: S
  private readonly _subject: ISubject<T>

  constructor(source: S, func: DerivedFunc<S, T>) {
    this._source = source
    this._subject = new Subject<T>({
      startStopNotifier: (emit, update) => {
        const values: StoresValues<S> = [] as any
        const unsubscribes: Unsubscribe[] = []
        this._source.forEach((src, index) => {
          unsubscribes.push(
            src.subscribe(value => {
              values[index] = value
              // TODO: нужно как-то реализовать синхронный отложенный вызов,
              // т.е. нужно как-то ловить момент когда все подписки обработаны,
              // а для этого нужен глобальный объект отслеживающий все узлы.
              // И получается эта штука не совместима со svelte,
              // т.к. там свой глобальный объект.
              const result = func(values, emit, update)
            }),
          )
        })

        const result = func(values, emit, update)
        if (func.length <= 1) {
          emit(result as T)
        }

        return () => {
          unsubscribes.forEach(o => o())
          if (func.length > 1) {
            ;(result as Unsubscribe)()
          }
        }
      },
    })
  }

  subscribe(listener: Listener<T>): Unsubscribe {
    return this._subject.subscribe(listener)
  }
}

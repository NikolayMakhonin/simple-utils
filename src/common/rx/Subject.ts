import type {
  ActionOnCircular,
  Emit,
  Invalidate,
  ISubject,
  Listener,
  StartStopNotifier,
  Update,
} from './types'
import type { PromiseOrValue, Unsubscribe } from 'src/common/types/common'
import { isPromiseLike } from 'src/common/async/promise/isPromiseLike'

export type SubjectOptions<T> = {
  emitLastEvent?: null | boolean
  startStopNotifier?: null | StartStopNotifier<T>
  hasLast?: null | boolean
  last?: T
  /** Action to perform on circular subscription or emission. Default is 'throw' */
  actionOnCircular?: null | ActionOnCircular
  /** Clears state when the last subscriber unsubscribes */
  autoClear?: null | boolean
}

export class Subject<From = void> implements ISubject<From> {
  readonly #listeners = new Map<object, Listener<From>>()
  readonly #listenersAdd = new Map<object, Listener<From>>()
  readonly #invalidates = new Map<object, Invalidate>()
  readonly #startStopNotifier: null | StartStopNotifier<From>
  readonly #emit: Emit<From> | null
  readonly #update: Update<From> | null
  readonly #invalidate: Invalidate | null
  #unsubscribeNotifier: null | Unsubscribe = null
  readonly #emitLast: boolean
  #hasLast: boolean
  #last: From | undefined = undefined
  #emitting: boolean = false
  #subscribing: boolean = false
  #invalidated: boolean = false
  readonly #actionOnCircular: ActionOnCircular
  readonly #autoClear: boolean

  constructor({
    emitLastEvent,
    startStopNotifier,
    hasLast,
    last,
    actionOnCircular,
    autoClear,
  }: SubjectOptions<From> = {}) {
    this.#startStopNotifier = startStopNotifier ?? null
    this.#emit = startStopNotifier ? value => this.emit(value) : null
    this.#update = startStopNotifier ? updater => this.update(updater) : null
    this.#invalidate = startStopNotifier ? () => this.invalidate() : null
    this.#emitLast = emitLastEvent ?? false
    this.#hasLast = hasLast ?? false
    this.#last = last
    this.#actionOnCircular = actionOnCircular ?? 'throw'
    this.#autoClear = autoClear ?? false
  }

  get emitLast(): boolean {
    return this.#emitLast
  }

  get hasLast(): boolean {
    return this.#hasLast
  }

  get last(): From | undefined {
    return this.#last
  }

  get hasListeners(): boolean {
    return this.#listeners.size > 0 || this.#listenersAdd.size > 0
  }

  subscribe(
    listener: Listener<From>,
    invalidate?: null | Invalidate,
  ): Unsubscribe {
    if (this.#subscribing && this.#actionOnCircular === 'throw') {
      throw new Error('[Rx][Subject] Circular subscription detected')
    }
    const id = {}
    if (this.#emitting) {
      this.#listenersAdd.set(id, listener)
    } else {
      this.#listeners.set(id, listener)
    }
    if (invalidate != null) {
      this.#invalidates.set(id, invalidate)
    }
    if (
      this.#hasLast ||
      // Even if there is no hasLast we should send something, even undefined
      (this.#subscribing && this.#actionOnCircular === 'emitLast')
    ) {
      listener(this.#last!)
    }
    if (invalidate != null && this.#invalidated) {
      invalidate()
    }
    if (
      this.#startStopNotifier &&
      this.#listeners.size + this.#listenersAdd.size === 1
    ) {
      try {
        this.#subscribing = true
        this.#unsubscribeNotifier =
          this.#startStopNotifier(
            this.#emit!,
            this.#update!,
            this.#invalidate!,
          ) ?? null
      } finally {
        this.#subscribing = false
      }
    }
    return () => {
      this.#listeners.delete(id)
      this.#listenersAdd.delete(id)
      this.#invalidates.delete(id)
      if (this.#listeners.size === 0 && this.#listenersAdd.size === 0) {
        if (this.#startStopNotifier) {
          const unsubscribeNotifier = this.#unsubscribeNotifier
          this.#unsubscribeNotifier = null
          unsubscribeNotifier?.()
        }
        if (this.#autoClear) {
          this.#hasLast = false
          this.#last = undefined
          this.#invalidated = false
        }
      }
    }
  }

  /** Marks the value as stale and notifies invalidate callbacks */
  invalidate(): void {
    if (this.#invalidated) {
      return
    }
    this.#invalidated = true
    this.#invalidates.forEach(o => o())
  }

  emit(event: From): PromiseOrValue<void> {
    if (this.#emitting) {
      if (this.#actionOnCircular === 'throw') {
        throw new Error('[Rx][Subject] Circular emit detected')
      }
      if (this.#actionOnCircular === 'emitLast') {
        this.#last = event
        this.#hasLast = true
      }
      return
    }
    const onFinally = () => {
      if (this.#listenersAdd.size > 0) {
        this.#listenersAdd.forEach((listener, id) => {
          this.#listeners.set(id, listener)
        })
        this.#listenersAdd.clear()
      }
      this.#emitting = false
    }
    try {
      this.#emitting = true
      this.invalidate()
      this.#invalidated = false
      if (this.#emitLast) {
        this.#last = event
        this.#hasLast = true
      }
      let promises: PromiseLike<void>[] | undefined
      this.#listeners.forEach(listener => {
        const promiseOrValue = listener(event)
        if (isPromiseLike(promiseOrValue)) {
          if (!promises) {
            promises = []
          }
          promises.push(promiseOrValue)
        }
      })
      if (promises) {
        return Promise.all(promises).then(onFinally, err => {
          onFinally()
          throw err
        })
      }
      onFinally()
    } catch (error) {
      onFinally()
      throw error
    }
  }

  update(updater: (event: From) => From): PromiseOrValue<void> {
    if (!this.#emitLast) {
      throw new Error(
        '[Rx][Subject] update available only for subjects with emitLastEvent',
      )
    }
    const newEvent = updater(this.#last!)
    return this.emit(newEvent)
  }
}

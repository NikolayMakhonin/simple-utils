import type { Invalidate, ISubject, Listener } from './types'
import { type PromiseOrValue, type Unsubscribe } from 'src/common/types/common'
import { isPromiseLike } from 'src/common/async/promise/isPromiseLike'

export type Emit<T> = (value: T) => PromiseOrValue<void>
export type Updater<T> = (event: T) => T
export type Update<T> = (updater: Updater<T>) => void

export type StartStopNotifier<T> = (
  emit: Emit<T>,
  update: Update<T>,
) => void | Unsubscribe

export type ActionOnCycle = 'emitLast' | 'throw' | false

export type SubjectOptions<T> = {
  emitLastEvent?: null | boolean
  startStopNotifier?: null | StartStopNotifier<T>
  hasLast?: null | boolean
  last?: T
  actionOnCycle?: null | ActionOnCycle
}

export class Subject<From = void> implements ISubject<From> {
  readonly #listeners = new Map<object, (event: From) => void>()
  readonly #listenersAdd = new Map<object, (event: From) => void>()
  readonly #invalidates = new Map<object, Invalidate>()
  readonly #startStopNotifier: null | StartStopNotifier<From>
  readonly #emit: ((value: From) => PromiseOrValue<void>) | null
  readonly #update: ((updater: (event: From) => From) => void) | null
  #unsubscribeNotifier: null | Unsubscribe = null
  readonly #emitLast: boolean
  #hasLast: boolean
  #last: From | undefined = undefined
  #emitting: boolean = false
  #subscribing: boolean = false
  #invalidated: boolean = false
  readonly #actionOnCycle: ActionOnCycle

  constructor({
    emitLastEvent,
    startStopNotifier,
    hasLast,
    last,
    actionOnCycle,
  }: SubjectOptions<From> = {}) {
    this.#startStopNotifier = startStopNotifier ?? null
    this.#emit = startStopNotifier ? value => this.emit(value) : null
    this.#update = startStopNotifier ? updater => this.update(updater) : null
    this.#emitLast = emitLastEvent ?? false
    this.#hasLast = hasLast ?? false
    this.#last = last
    this.#actionOnCycle = actionOnCycle ?? false
  }

  get hasLast(): boolean {
    return this.#hasLast
  }

  get last(): From | undefined {
    return this.#last
  }

  get hasListeners(): boolean {
    return this.#listeners.size > 0
  }

  subscribe(
    listener: Listener<From>,
    invalidate?: null | Invalidate,
  ): Unsubscribe {
    const id = {}
    if (this.#emitting) {
      this.#listenersAdd.set(id, listener)
    } else {
      this.#listeners.set(id, listener)
    }
    if (invalidate != null) {
      this.#invalidates.set(id, invalidate)
    }
    if (this.#subscribing && this.#actionOnCycle === 'throw') {
      throw new Error('[Rx][Subject] Circular subscription detected')
    }
    if (
      this.#hasLast ||
      (this.#subscribing && this.#actionOnCycle === 'emitLast')
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
          this.#startStopNotifier(this.#emit!, this.#update!) ?? null
      } finally {
        this.#subscribing = false
      }
    }
    return () => {
      this.#listeners.delete(id)
      this.#listenersAdd.delete(id)
      this.#invalidates.delete(id)
      if (
        this.#startStopNotifier &&
        this.#listeners.size === 0 &&
        this.#listenersAdd.size === 0
      ) {
        const unsubscribeNotifier = this.#unsubscribeNotifier
        this.#unsubscribeNotifier = null
        unsubscribeNotifier?.()
      }
    }
  }

  /**
   * Marks the value stale and notifies subscribers' invalidate callbacks
   * Does nothing when already stale
   * Emit makes the value valid again
   */
  invalidate(): void {
    if (this.#invalidated) {
      return
    }
    this.#invalidated = true
    this.#invalidates.forEach(o => o())
  }

  emit(event: From): PromiseOrValue<void> {
    if (this.#emitting) {
      if (this.#actionOnCycle === 'throw') {
        throw new Error('[Rx][Subject] Circular emit detected')
      }
      if (this.#actionOnCycle === 'emitLast') {
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

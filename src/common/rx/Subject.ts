import type { ISubject, Listener } from './types'
import { isPromiseLike } from '@flemist/async-utils'
import { type PromiseOrValue, type Unsubscribe } from 'src/common/types/common'

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

export class Subject<T = void> implements ISubject<T> {
  private readonly _listeners = new Map<object, (event: T) => void>()
  private readonly _listenersAdd = new Map<object, (event: T) => void>()
  private readonly _startStopNotifier: null | StartStopNotifier<T>
  private readonly _emit: ((value: T) => PromiseOrValue<void>) | null
  private readonly _update: ((updater: (event: T) => T) => void) | null
  private _unsubscribeNotifier: null | Unsubscribe = null
  private readonly _emitLast: boolean
  private _hasLast: boolean
  private _last: T | undefined = undefined
  private _emitting: boolean = false
  private _subscribing: boolean = false
  private readonly _actionOnCycle: ActionOnCycle

  constructor({
    emitLastEvent,
    startStopNotifier,
    hasLast,
    last,
    actionOnCycle,
  }: SubjectOptions<T> = {}) {
    this._startStopNotifier = startStopNotifier ?? null
    this._emit = startStopNotifier ? value => this.emit(value) : null
    this._update = startStopNotifier ? updater => this.update(updater) : null
    this._emitLast = emitLastEvent ?? false
    this._hasLast = hasLast ?? false
    this._last = last
    this._actionOnCycle = actionOnCycle ?? false
  }

  get hasLast(): boolean {
    return this._hasLast
  }

  get last(): T | undefined {
    return this._last
  }

  get hasListeners(): boolean {
    return this._listeners.size > 0
  }

  subscribe(listener: Listener<T>): Unsubscribe {
    const id = {}
    if (this._emitting) {
      this._listenersAdd.set(id, listener)
    } else {
      this._listeners.set(id, listener)
    }
    if (this._subscribing && this._actionOnCycle === 'throw') {
      throw new Error('[Rx][Subject] Circular subscription detected')
    }
    if (
      this._hasLast ||
      (this._subscribing && this._actionOnCycle === 'emitLast')
    ) {
      listener(this._last!)
    }
    if (
      this._startStopNotifier &&
      this._listeners.size + this._listenersAdd.size === 1
    ) {
      try {
        this._subscribing = true
        this._unsubscribeNotifier =
          this._startStopNotifier(this._emit!, this._update!) ?? null
      } finally {
        this._subscribing = false
      }
    }
    return () => {
      this._listeners.delete(id)
      this._listenersAdd.delete(id)
      if (
        this._startStopNotifier &&
        this._listeners.size === 0 &&
        this._listenersAdd.size === 0
      ) {
        const unsubscribeNotifier = this._unsubscribeNotifier
        this._unsubscribeNotifier = null
        unsubscribeNotifier?.()
      }
    }
  }

  emit(event: T): PromiseOrValue<void> {
    if (this._emitting) {
      if (this._actionOnCycle === 'throw') {
        throw new Error('[Rx][Subject] Circular emit detected')
      }
      if (this._actionOnCycle === 'emitLast') {
        this._last = event
        this._hasLast = true
      }
      return
    }
    const onFinally = () => {
      if (this._listenersAdd.size > 0) {
        this._listenersAdd.forEach((listener, id) => {
          this._listeners.set(id, listener)
        })
        this._listenersAdd.clear()
      }
      this._emitting = false
    }
    try {
      this._emitting = true
      if (this._emitLast) {
        this._last = event
        this._hasLast = true
      }
      let promises: PromiseLike<void>[] | undefined
      this._listeners.forEach(listener => {
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

  update(updater: (event: T) => T): PromiseOrValue<void> {
    if (!this._emitLast) {
      throw new Error(
        '[Rx][Subject] update available only for subjects with emitLastEvent',
      )
    }
    const newEvent = updater(this._last!)
    return this.emit(newEvent)
  }
}

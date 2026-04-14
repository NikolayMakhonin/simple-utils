import {
  isPromiseLike,
  type PromiseLikeOrValue,
  promiseLikeToPromise,
} from '@flemist/async-utils'
import type { PromiseOrValue } from 'src/common/types/common'

export type LockFunc = <T>(
  handler: () => PromiseLikeOrValue<T>,
) => PromiseOrValue<T>

export interface ILocker {
  lock: LockFunc
  hasQueued: boolean
}

export class Locker implements ILocker {
  private _lockPromise: null | PromiseLike<void> = null

  get hasQueued(): boolean {
    return this._lockPromise != null
  }

  lock<T>(handler: () => PromiseLikeOrValue<T>): PromiseOrValue<T> {
    if (this._lockPromise) {
      return promiseLikeToPromise(
        this._lockPromise.then(() => this.lock(handler)),
      )
    }
    const promiseOrValue = handler()
    if (isPromiseLike(promiseOrValue)) {
      const promise = promiseOrValue.then(
        () => {
          if (this._lockPromise === promise) {
            this._lockPromise = null
          }
        },
        () => {
          if (this._lockPromise === promise) {
            this._lockPromise = null
          }
        },
      )
      this._lockPromise = promise
    }
    return promiseLikeToPromise(promiseOrValue)
  }
}

export interface ILockerWithId<Id> {
  lock: <T>(id: Id, handler: () => PromiseLikeOrValue<T>) => PromiseOrValue<T>
}

export class LockerWithId<Id> implements ILockerWithId<Id> {
  private readonly _lockers: Map<Id, Locker> = new Map()

  lock<T>(id: Id, handler: () => PromiseLikeOrValue<T>): PromiseOrValue<T> {
    let locker = this._lockers.get(id)
    if (locker == null) {
      locker = new Locker()
      this._lockers.set(id, locker)
    }
    const cleanup = () => {
      if (!locker.hasQueued) {
        this._lockers.delete(id)
      }
    }
    let resultOrPromise: PromiseOrValue<T>
    try {
      resultOrPromise = locker.lock(handler)
    } catch (err) {
      cleanup()
      throw err
    }
    if (isPromiseLike(resultOrPromise)) {
      return resultOrPromise.then(
        result => {
          cleanup()
          return result
        },
        err => {
          cleanup()
          throw err
        },
      )
    }
    cleanup()
    return resultOrPromise
  }
}

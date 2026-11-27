import { promiseLikeToPromise } from './promise/promiseLikeToPromise'
import type {
  PromiseLikeOrValue,
  PromiseOrValue,
} from 'src/common/types/common'
import { isPromiseLike } from './promise/isPromiseLike'

export type LockFunc = {
  <T>(handler: () => PromiseLike<T>): Promise<T>
  <T>(handler: () => PromiseLikeOrValue<T>): PromiseOrValue<T>
}

export interface ILocker {
  lock: LockFunc
  /** Whether an operation of lock runs or waits for its turn */
  hasQueued: boolean
}

export class Locker implements ILocker {
  #lockPromise: null | PromiseLike<void> = null

  get hasQueued(): boolean {
    return this.#lockPromise != null
  }

  lock<T>(handler: () => PromiseLikeOrValue<T>): PromiseOrValue<T> {
    // A call that waits runs its handler after #lockPromise and replaces it below,
    // so that hasQueued stays true until the operation of the last call completes
    const promiseOrValue = this.#lockPromise
      ? this.#lockPromise.then(() => handler())
      : handler()
    if (isPromiseLike(promiseOrValue)) {
      const promise = promiseOrValue.then(
        () => {
          if (this.#lockPromise === promise) {
            this.#lockPromise = null
          }
        },
        () => {
          if (this.#lockPromise === promise) {
            this.#lockPromise = null
          }
        },
      )
      this.#lockPromise = promise
    }
    return promiseLikeToPromise(promiseOrValue)
  }
}

export type LockWithIdFunc<Id> = {
  <T>(id: Id, handler: () => PromiseLike<T>): Promise<T>
  <T>(id: Id, handler: () => PromiseLikeOrValue<T>): PromiseOrValue<T>
}

export interface ILockerWithId<Id> {
  lock: LockWithIdFunc<Id>
  /** Whether an operation of lock with this id runs or waits for its turn */
  hasQueued(id: Id): boolean
}

export class LockerWithId<Id> implements ILockerWithId<Id> {
  readonly #lockers: Map<Id, Locker> = new Map()

  lock<T>(id: Id, handler: () => PromiseLikeOrValue<T>): PromiseOrValue<T> {
    let locker = this.#lockers.get(id)
    if (locker == null) {
      locker = new Locker()
      this.#lockers.set(id, locker)
    }
    const cleanup = () => {
      if (!locker.hasQueued) {
        this.#lockers.delete(id)
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

  hasQueued(id: Id): boolean {
    const locker = this.#lockers.get(id)
    return locker != null && locker.hasQueued
  }
}

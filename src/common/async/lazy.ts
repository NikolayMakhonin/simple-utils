import type { PromiseOrValue } from 'src/common/types/common'
import { isPromiseLike } from './promise/isPromiseLike'

// TODO: write doc comments
export interface ILazy<T = void> {
  run(): PromiseOrValue<T>
}

// TODO: write doc comments
export type LazyOptions<T> = {
  func: () => PromiseOrValue<T>
  /** If true, the result will be cached */
  persist?: null | boolean
}

// TODO: write doc comments
export class Lazy<T = void> implements ILazy<T> {
  readonly #options: LazyOptions<T>
  #hasValue: boolean = false
  #promiseOrValue: PromiseOrValue<T> | null = null

  constructor(options: LazyOptions<T>) {
    this.#options = options
  }

  run(): PromiseOrValue<T> {
    if (!this.#hasValue) {
      let promiseOrValue = this.#options.func()

      const onResolve = (value: T) => {
        if (!this.#options.persist) {
          this.#promiseOrValue = null
          this.#hasValue = false
        } else {
          this.#promiseOrValue = value
        }
        return value
      }
      const onReject = (error: any) => {
        if (!this.#options.persist) {
          this.#promiseOrValue = null
          this.#hasValue = false
        }
        throw error
      }

      if (isPromiseLike(promiseOrValue)) {
        promiseOrValue = promiseOrValue.then(onResolve, onReject)
      } else {
        if (!this.#options.persist) {
          return promiseOrValue
        }
      }

      this.#promiseOrValue = promiseOrValue
      this.#hasValue = true
    }
    return this.#promiseOrValue!
  }

  set(value: PromiseOrValue<T>): void {
    if (!this.#options.persist) {
      throw new Error('[Lazy][set] Cannot set value when persist is false')
    }
    this.#hasValue = true
    this.#promiseOrValue = value
  }
}

// TODO: write doc comments
export interface ILazyWithId<Id, Result = void> {
  run(id: Id): PromiseOrValue<Result>
}

// TODO: write doc comments
export type LazyWithIdOptions<Id, Result> = {
  func: (id: Id) => PromiseOrValue<Result>
  persist?: null | boolean
}

// TODO: write doc comments
export class LazyWithId<Id, Result = void> implements ILazyWithId<Id, Result> {
  readonly #options: LazyWithIdOptions<Id, Result>
  #promiseOrValues: Map<Id, PromiseOrValue<Result>> = new Map()

  constructor(options: LazyWithIdOptions<Id, Result>) {
    this.#options = options
  }

  run(id: Id): PromiseOrValue<Result> {
    if (this.#promiseOrValues.has(id)) {
      const promiseOrValue = this.#promiseOrValues.get(id)
      return promiseOrValue!
    }
    let promiseOrValue = this.#options.func(id)
    const onResolve = (value: Result) => {
      if (!this.#options.persist) {
        this.#promiseOrValues.delete(id)
      } else {
        this.#promiseOrValues.set(id, value)
      }
      return value
    }
    const onReject = (error: any) => {
      if (!this.#options.persist) {
        this.#promiseOrValues.delete(id)
      }
      throw error
    }

    if (isPromiseLike(promiseOrValue)) {
      promiseOrValue = promiseOrValue.then(onResolve, onReject)
    } else {
      if (!this.#options.persist) {
        return promiseOrValue
      }
    }

    this.#promiseOrValues.set(id, promiseOrValue)

    return promiseOrValue
  }

  set(id: Id, value: PromiseOrValue<Result>): void {
    if (!this.#options.persist) {
      throw new Error(
        '[LazyWithId][set] Cannot set value when persist is false',
      )
    }
    this.#promiseOrValues.set(id, value)
  }
}

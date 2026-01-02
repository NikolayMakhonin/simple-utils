import { isPromiseLike, type PromiseOrValue } from '@flemist/async-utils'

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
  private readonly _options: LazyOptions<T>
  private _hasValue: boolean = false
  private _promiseOrValue: PromiseOrValue<T> | null = null

  constructor(options: LazyOptions<T>) {
    this._options = options
  }

  run(): PromiseOrValue<T> {
    if (!this._hasValue) {
      let promiseOrValue = this._options.func()

      const onResolve = (value: T) => {
        if (!this._options.persist) {
          this._promiseOrValue = null
          this._hasValue = false
        } else {
          this._promiseOrValue = value
        }
        return value
      }
      const onReject = (error: any) => {
        if (!this._options.persist) {
          this._promiseOrValue = null
          this._hasValue = false
        }
        throw error
      }

      if (isPromiseLike(promiseOrValue)) {
        promiseOrValue = promiseOrValue.then(onResolve, onReject)
      } else {
        if (!this._options.persist) {
          return promiseOrValue
        }
      }

      this._promiseOrValue = promiseOrValue
      this._hasValue = true
    }
    return this._promiseOrValue!
  }

  set(value: PromiseOrValue<T>): void {
    if (!this._options.persist) {
      throw new Error('[Lazy][set] Cannot set value when persist is false')
    }
    this._hasValue = true
    this._promiseOrValue = value
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
  private readonly _options: LazyWithIdOptions<Id, Result>
  private _promiseOrValues: Map<Id, PromiseOrValue<Result>> = new Map()

  constructor(options: LazyWithIdOptions<Id, Result>) {
    this._options = options
  }

  run(id: Id): PromiseOrValue<Result> {
    if (this._promiseOrValues.has(id)) {
      const promiseOrValue = this._promiseOrValues.get(id)
      return promiseOrValue!
    }
    let promiseOrValue = this._options.func(id)
    const onResolve = (value: Result) => {
      if (!this._options.persist) {
        this._promiseOrValues.delete(id)
      } else {
        this._promiseOrValues.set(id, value)
      }
      return value
    }
    const onReject = (error: any) => {
      if (!this._options.persist) {
        this._promiseOrValues.delete(id)
      }
      throw error
    }

    if (isPromiseLike(promiseOrValue)) {
      promiseOrValue = promiseOrValue.then(onResolve, onReject)
    } else {
      if (!this._options.persist) {
        return promiseOrValue
      }
    }

    this._promiseOrValues.set(id, promiseOrValue)

    return promiseOrValue
  }

  set(id: Id, value: PromiseOrValue<Result>): void {
    if (!this._options.persist) {
      throw new Error(
        '[LazyWithId][set] Cannot set value when persist is false',
      )
    }
    this._promiseOrValues.set(id, value)
  }
}

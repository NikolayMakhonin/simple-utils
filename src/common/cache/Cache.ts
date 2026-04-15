import { isPromiseLike, type PromiseLikeOrValue } from '@flemist/async-utils'
import type { ICache, IStorage } from './types'
import type { ConverterAsync, ConvertToAsync } from 'src/common/converter'
import {
  type ITimeController,
  timeControllerDefault,
} from '@flemist/time-controller'
import { type ILockerWithId, LockerWithId } from '../async'

export type CacheStorages<Key, Value, Error, Stat> = {
  value: IStorage<Key, Value>
  error: IStorage<Key, Error>
  stat: IStorage<Key, Stat>
}

export type CacheOptions<
  Input,
  Value,
  Error,
  Stat,
  Key,
  ValueStored,
  ErrorStored,
  StatStored,
> = {
  converterInput: ConvertToAsync<Input, Key>
  converterValue: ConverterAsync<Value, ValueStored>
  converterError: ConverterAsync<Error, ErrorStored>
  converterStat: ConverterAsync<Stat, StatStored>
  storages: CacheStorages<Key, ValueStored, ErrorStored, StatStored>
  isExpired?: null | ((stat: Stat) => boolean)
  timeController?: null | ITimeController
}

export type CacheStat = {
  /** Date when the value or error was created last time */
  dateModified: number
  dateUsed: number
  hasError?: null | boolean
}

export class Cache<
  Input,
  Value,
  Error,
  Key,
  ValueStored,
  ErrorStored,
  StatStored,
> implements ICache<Input, Value>
{
  private readonly _options: CacheOptions<
    Input,
    Value,
    Error,
    CacheStat,
    Key,
    ValueStored,
    ErrorStored,
    StatStored
  >
  private readonly _timeController: ITimeController
  private readonly _locker: ILockerWithId<Key>

  constructor(
    options: CacheOptions<
      Input,
      Value,
      Error,
      CacheStat,
      Key,
      ValueStored,
      ErrorStored,
      StatStored
    >,
  ) {
    this._options = options
    this._timeController = options.timeController ?? timeControllerDefault
    this._locker = new LockerWithId()
  }

  async getOrCreate<T extends Value>(
    input: Input,
    func: (input: Input) => PromiseLikeOrValue<T>,
  ): Promise<T> {
    const key = await this._options.converterInput(input)

    return this._locker.lock(key, async () => {
      const storedStat = await this._options.storages.stat.get(key)
      let isExpired: boolean
      let stat: CacheStat | null = null
      if (storedStat) {
        stat = await this._options.converterStat.from(storedStat)
        isExpired =
          this._options.isExpired != null
            ? this._options.isExpired(stat)
            : false
      } else {
        isExpired = true
      }

      if (isExpired) {
        await Promise.all([
          this._options.storages.value.delete(key),
          this._options.storages.error.delete(key),
          this._options.storages.stat.delete(key),
        ])
      } else {
        const [storedValue, storedError] = await Promise.all([
          this._options.storages.value.get(key),
          this._options.storages.error.get(key),
        ])

        const now = this._timeController.now()

        if (storedValue != null) {
          stat = {
            dateModified: stat?.dateModified ?? now,
            dateUsed: now,
          }
          const [value, storedStat] = await Promise.all([
            this._options.converterValue.from(storedValue),
            this._options.converterStat.to(stat),
          ])
          await this._options.storages.stat.set(key, storedStat)
          return value as T
        }

        if (storedError != null) {
          stat = {
            dateModified: stat?.dateModified ?? now,
            dateUsed: now,
            hasError: true,
          }
          const [error, storedStat] = await Promise.all([
            this._options.converterError.from(storedError),
            this._options.converterStat.to(stat),
          ])
          await this._options.storages.stat.set(key, storedStat)
          throw error
        }
      }

      try {
        const value = await func(input)
        const now = this._timeController.now()
        stat = {
          dateModified: now,
          dateUsed: now,
        }
        const [storedValue, storedStat] = await Promise.all([
          this._options.converterValue.to(value),
          this._options.converterStat.to(stat),
        ])
        await this._options.storages.value.set(key, storedValue)
        await Promise.all([
          this._options.storages.stat.set(key, storedStat),
          this._options.storages.error.delete(key),
        ])
        return value
      } catch (err) {
        const now = this._timeController.now()
        stat = {
          dateModified: now,
          dateUsed: now,
          hasError: true,
        }
        const [storedError, storedStat] = await Promise.all([
          this._options.converterError.to(err),
          this._options.converterStat.to(stat),
        ])
        await Promise.all([
          this._options.storages.value.delete(key),
          this._options.storages.error.set(key, storedError),
        ])
        await this._options.storages.stat.set(key, storedStat)
        throw err
      }
    })
  }

  async delete(input: Input): Promise<void> {
    const key = await this._options.converterInput(input)
    return this._locker.lock(key, async () => {
      await Promise.all([
        this._options.storages.value.delete(key),
        this._options.storages.error.delete(key),
        this._options.storages.stat.delete(key),
      ])
    })
  }

  async clear(): Promise<void> {
    const [keysValue, keysError, keysStat] = await Promise.all([
      this._options.storages.value.getKeys(),
      this._options.storages.error.getKeys(),
      this._options.storages.stat.getKeys(),
    ])
    const keys = new Set([...keysValue, ...keysError, ...keysStat])
    const promises: Promise<void>[] = []
    keys.forEach(key => {
      const promiseOrValue = this._locker.lock(key, async () => {
        const promises: PromiseLike<void>[] = []
        let promiseOrValue: PromiseLikeOrValue<void>
        promiseOrValue = this._options.storages.value.delete(key)
        if (isPromiseLike(promiseOrValue)) {
          promises.push(promiseOrValue)
        }
        promiseOrValue = this._options.storages.error.delete(key)
        if (isPromiseLike(promiseOrValue)) {
          promises.push(promiseOrValue)
        }
        promiseOrValue = this._options.storages.stat.delete(key)
        if (isPromiseLike(promiseOrValue)) {
          promises.push(promiseOrValue)
        }
        await Promise.all(promises)
      })
      if (isPromiseLike(promiseOrValue)) {
        promises.push(promiseOrValue)
      }
    })
    await Promise.all(promises)
  }
}

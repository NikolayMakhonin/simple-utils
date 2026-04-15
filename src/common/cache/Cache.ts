import { isPromiseLike, type PromiseLikeOrValue } from '@flemist/async-utils'
import type { ICache, IStorage, IStorageDb } from './types'
import type { ConverterAsync, ConvertToAsync } from 'src/common/converter'
import {
  type ITimeController,
  timeControllerDefault,
} from '@flemist/time-controller'
import { type ILockerWithId, LockerWithId } from '../async'
import type { NumberRange } from '../types'

export type CacheStorages<Key, Value, Error, Stat> = {
  value: IStorage<Key, Value>
  error: IStorage<Key, Error>
  stat: IStorageDb<Key, Stat>
}

export type CacheOptions<
  Input,
  Value,
  Error,
  Stat,
  Key = Input,
  ValueStored = Value,
  ErrorStored = Error,
  StatStored = Stat,
> = {
  converterInput?: null | ConvertToAsync<Input, Key>
  converterValue?: null | ConverterAsync<Value, ValueStored>
  converterError?: null | ConverterAsync<Error, ErrorStored>
  converterStat?: null | ConverterAsync<Stat, StatStored>
  storages: CacheStorages<Key, ValueStored, ErrorStored, StatStored>
  /**
   * 1) When adding a new value to the cache, the cache size should not exceed totalSize[1]
   * 2) After freeing up space, the cache size should not become less than totalSize[0]
   * If both conditions cannot be met at the same time, priority is given to the first condition
   * If it is not possible to meet even the first condition, an error is thrown
   */
  totalSize?: null | NumberRange
  getSize: {
    value: (value: ValueStored) => number
    error: (error: ErrorStored) => number
    stat: (stat: StatStored) => number
  }
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
    const key = this._options.converterInput
      ? await this._options.converterInput(input)
      : (input as unknown as Key)

    return this._locker.lock(key, async () => {
      const storedStat = await this._options.storages.stat.get(key)
      let isExpired: boolean
      let stat: CacheStat | null = null
      if (storedStat) {
        stat = this._options.converterStat
          ? await this._options.converterStat.from(storedStat)
          : (storedStat as unknown as CacheStat)
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
            this._options.converterValue
              ? await this._options.converterValue.from(storedValue)
              : (storedValue as unknown as Value),
            this._options.converterStat
              ? await this._options.converterStat.to(stat)
              : (stat as unknown as StatStored),
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
            this._options.converterError
              ? await this._options.converterError.from(storedError)
              : (storedError as unknown as Error),
            this._options.converterStat
              ? await this._options.converterStat.to(stat)
              : (stat as unknown as StatStored),
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
          this._options.converterValue
            ? await this._options.converterValue.to(value)
            : (value as unknown as ValueStored),
          this._options.converterStat
            ? await this._options.converterStat.to(stat)
            : (stat as unknown as StatStored),
        ])
        await this._options.storages.value.set(key, storedValue)
        await Promise.all([
          this._options.storages.stat.set(key, storedStat),
          this._options.storages.error.delete(key),
        ])
        return value
      } catch (error) {
        const now = this._timeController.now()
        stat = {
          dateModified: now,
          dateUsed: now,
          hasError: true,
        }
        const [storedError, storedStat] = await Promise.all([
          this._options.converterError
            ? await this._options.converterError.to(error)
            : (error as unknown as ErrorStored),
          this._options.converterStat
            ? await this._options.converterStat.to(stat)
            : (stat as unknown as StatStored),
        ])
        await Promise.all([
          this._options.storages.value.delete(key),
          this._options.storages.error.set(key, storedError),
        ])
        await this._options.storages.stat.set(key, storedStat)
        throw error
      }
    })
  }

  async delete(input: Input): Promise<void> {
    const key = this._options.converterInput
      ? await this._options.converterInput(input)
      : (input as unknown as Key)
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

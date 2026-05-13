import type { PromiseLikeOrValue } from 'src/common/types/common'
import type {
  CacheStat,
  ICache,
  ICacheStats,
  IStorage,
  IStorageDb,
} from './types'
import type { ConverterAsync, ConvertToAsync } from 'src/common/converter'
import {
  type ITimeController,
  timeControllerDefault,
} from '@flemist/time-controller'
import {
  type ILockerWithId,
  LockerWithId,
  promiseAllWait,
} from 'src/common/async'
import type { NumberRange } from 'src/common/types'
import { CacheStats } from './CacheStats'
import { isPromiseLike } from 'src/common/async/promise/isPromiseLike'

export type CacheStorages<Key, Value, Error, Stat> = {
  value: IStorage<Key, Value>
  error?: null | IStorage<Key, Error>
  stat: IStorageDb<Key, Stat>
}

export type CacheOptions<
  Input,
  Value,
  Error,
  Stat extends CacheStat,
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
    stat: () => number
  }
  isExpired?: null | ((stat: Stat) => boolean)
  timeController?: null | ITimeController
}

/** Compare function for LRU eviction strategy */
function compareLru<Key, Stat extends CacheStat>(
  a: [Key, Stat],
  b: [Key, Stat],
): -1 | 0 | 1 {
  if (a[1].dateUsed !== b[1].dateUsed) {
    return a[1].dateUsed < b[1].dateUsed ? -1 : 1
  }
  if (a[1].size !== b[1].size) {
    return a[1].size < b[1].size ? -1 : 1
  }
  if (a[1].dateModified !== b[1].dateModified) {
    return a[1].dateModified < b[1].dateModified ? -1 : 1
  }
  if (a[0] !== b[0]) {
    return a[0] < b[0] ? -1 : 1
  }
  return 0
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
  readonly #options: CacheOptions<
    Input,
    Value,
    Error,
    CacheStat,
    Key,
    ValueStored,
    ErrorStored,
    StatStored
  >
  readonly #timeController: ITimeController
  readonly #locker: ILockerWithId<Key>
  readonly #stats: ICacheStats<Key, CacheStat>

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
    this.#options = options
    this.#timeController = options.timeController ?? timeControllerDefault
    this.#locker = new LockerWithId()
    this.#stats = new CacheStats({
      storage: options.storages.stat,
      converter: options.converterStat,
    })
  }

  private async freeUpSpace(
    currentKey: Key,
    sizeOld: number | null | undefined,
    sizeNew: number,
  ): Promise<void> {
    if (this.#options.totalSize == null) {
      return
    }

    const totalSizeMin = this.#options.totalSize[0]
    const totalSizeMax = this.#options.totalSize[1]

    if (sizeNew > totalSizeMax) {
      throw new Error(
        `[Cache][freeUpSpace] value size (${sizeNew}) exceeds maximum total size (${totalSizeMax})`,
      )
    }

    let totalSize = await this.#stats.getTotalSize()
    totalSize += sizeNew - (sizeOld ?? 0)

    if (totalSize <= totalSizeMax) {
      return
    }

    const promises: PromiseLike<void>[] = []

    const stats = await this.#stats.getEntries()
    const statsArray = Array.from(stats.entries())
    statsArray.sort(compareLru)

    statsArray.forEach(([key, stat]) => {
      // Skip the current key: its space contribution is already accounted for
      if (key === currentKey) {
        return
      }

      // Those that are currently queued are obviously not worth deleting, since they are needed right now
      const hasQueued = this.#locker.hasQueued(key)
      if (hasQueued) {
        return
      }

      const totalSizeDelta = -stat.size
      if (
        totalSize > totalSizeMax ||
        totalSize + totalSizeDelta > totalSizeMin
      ) {
        promises.push(
          this.#locker.lock(key, async () => {
            await promiseAllWait([
              this.#options.storages.value.delete(key),
              this.#options.storages.error?.delete(key),
            ])
            return this.#stats.set(key, null)
          }),
        )
        totalSize += totalSizeDelta
      }
    })

    await promiseAllWait(promises)
  }

  async getOrCreate<T extends Value>(
    input: Input,
    func: (input: Input) => PromiseLikeOrValue<T>,
  ): Promise<T> {
    const key = this.#options.converterInput
      ? await this.#options.converterInput(input)
      : (input as unknown as Key)

    return this.#locker.lock(key, async () => {
      let statOld = await this.#stats.get(key)

      if (
        statOld == null ||
        (this.#options.isExpired != null && this.#options.isExpired(statOld))
      ) {
        // Expired
        await promiseAllWait([
          this.#options.storages.value.delete(key),
          this.#options.storages.error?.delete(key),
          this.#stats.set(key, null),
        ])
        statOld = null
      } else {
        const [storedValue, storedError] = await Promise.all([
          this.#options.storages.value.get(key),
          this.#options.storages.error?.get(key),
        ])

        const now = this.#timeController.now()

        if (!statOld.hasError && storedValue != null) {
          const statNew = {
            ...statOld,
            dateUsed: now,
          }
          const value = this.#options.converterValue
            ? await this.#options.converterValue.from(storedValue)
            : (storedValue as unknown as Value)
          await this.#stats.set(key, statNew)
          return value as T
        }

        if (statOld.hasError && storedError != null) {
          const statNew = {
            ...statOld,
            dateUsed: now,
          }
          const error = this.#options.converterError
            ? await this.#options.converterError.from(storedError)
            : (storedError as unknown as Error)
          await this.#stats.set(key, statNew)
          throw error
        }
      }

      let value: T = null!
      let funcError: any = null
      let funcThrew = false
      try {
        value = await func(input)
      } catch (error) {
        funcError = error
        funcThrew = true
      }

      if (funcThrew) {
        if (this.#options.storages.error == null) {
          await promiseAllWait([
            this.#options.storages.value.delete(key),
            this.#stats.set(key, null),
          ])
          throw funcError
        }
        const storedError = this.#options.converterError
          ? await this.#options.converterError.to(funcError)
          : (funcError as unknown as ErrorStored)
        const size =
          this.#options.getSize.error(storedError) +
          this.#options.getSize.stat()
        await this.freeUpSpace(key, statOld?.size, size)
        await promiseAllWait([
          this.#options.storages.error.set(key, storedError),
          this.#options.storages.value.delete(key),
        ])
        const now = this.#timeController.now()
        const statNew: CacheStat = {
          dateModified: now,
          dateUsed: now,
          size,
          hasError: true,
        }
        await this.#stats.set(key, statNew)
        throw funcError
      }

      const storedValue = this.#options.converterValue
        ? await this.#options.converterValue.to(value)
        : (value as unknown as ValueStored)
      const size =
        this.#options.getSize.value(storedValue) + this.#options.getSize.stat()
      await this.freeUpSpace(key, statOld?.size, size)
      await promiseAllWait([
        this.#options.storages.value.set(key, storedValue),
        this.#options.storages.error?.delete(key),
      ])
      const now = this.#timeController.now()
      const statNew: CacheStat = {
        dateModified: now,
        dateUsed: now,
        size,
      }
      await this.#stats.set(key, statNew)
      return value
    })
  }

  async delete(input: Input): Promise<void> {
    const key = this.#options.converterInput
      ? await this.#options.converterInput(input)
      : (input as unknown as Key)
    return this.#locker.lock(key, async () => {
      await promiseAllWait([
        this.#options.storages.value.delete(key),
        this.#options.storages.error?.delete(key),
        this.#stats.set(key, null),
      ])
    })
  }

  /**
   * Deletes all cache entries at this moment.
   * But does not prevent new entries from being added during the clearing process
   */
  async clear(): Promise<void> {
    const [keysValue, keysError, keysStat] = await Promise.all([
      this.#options.storages.value.getKeys(),
      this.#options.storages.error?.getKeys(),
      this.#options.storages.stat.getKeys(),
    ])
    const keys = new Set([...keysValue, ...(keysError ?? []), ...keysStat])
    const promises: Promise<void>[] = []
    keys.forEach(key => {
      const promiseOrValue = this.#locker.lock(key, async () => {
        const innerPromises: PromiseLike<void>[] = []
        const valueDeleteResult = this.#options.storages.value.delete(key)
        if (isPromiseLike(valueDeleteResult)) {
          innerPromises.push(valueDeleteResult)
        }
        const errorDeleteResult = this.#options.storages.error?.delete(key)
        if (isPromiseLike(errorDeleteResult)) {
          innerPromises.push(errorDeleteResult)
        }
        const statSetResult = this.#stats.set(key, null)
        if (isPromiseLike(statSetResult)) {
          innerPromises.push(statSetResult)
        }
        await promiseAllWait(innerPromises)
      })
      if (isPromiseLike(promiseOrValue)) {
        promises.push(promiseOrValue)
      }
    })
    await promiseAllWait(promises)
  }
}

import type { CacheStat, ICacheStats, IStorageDb } from './types'
import type { ConverterAsync } from 'src/common/converter'
import { isPromiseLike } from 'src/common/async/promise/isPromiseLike'

export type CacheStatOptions<Key, Stat extends CacheStat, StatStored> = {
  storage: IStorageDb<Key, StatStored>
  converter?: null | ConverterAsync<Stat, StatStored>
}

export class CacheStats<Key, Stat extends CacheStat, StatStored>
  implements ICacheStats<Key, Stat>
{
  readonly #options: CacheStatOptions<Key, Stat, StatStored>
  #statsMap: Map<Key, Stat> = null!
  #totalSize: number = null!
  #initPromise: Promise<void> | null = null

  constructor(options: CacheStatOptions<Key, Stat, StatStored>) {
    this.#options = options
  }

  private async loadStatsMap(
    addItem: (key: Key, stat: Stat) => void,
  ): Promise<void> {
    const entries = await this.#options.storage.getEntries()

    const promises: PromiseLike<void>[] = []
    entries.forEach((statStored, key) => {
      const promiseOrValue = this.#options.converter
        ? this.#options.converter.from(statStored)
        : (statStored as unknown as Stat)
      if (isPromiseLike(promiseOrValue)) {
        promises.push(
          promiseOrValue.then(stat => {
            addItem(key, stat)
          }),
        )
      } else {
        addItem(key, promiseOrValue)
      }
    })

    await Promise.all(promises)
  }

  private init(): Promise<void> {
    if (this.#initPromise == null) {
      this.#initPromise = this._init()
    }
    return this.#initPromise
  }

  private async _init(): Promise<void> {
    const statsMap = new Map<Key, Stat>()
    let totalSize = 0

    await this.loadStatsMap((key, stat) => {
      statsMap.set(key, stat)
      totalSize += stat.size
    })

    this.#statsMap = statsMap
    this.#totalSize = totalSize
  }

  async getTotalSize(): Promise<number> {
    await this.init()
    return this.#totalSize
  }

  async get(key: Key): Promise<Stat | null> {
    await this.init()
    return this.#statsMap.get(key) ?? null
  }

  async set(key: Key, statNew: Stat | null | undefined): Promise<void> {
    await this.init()
    if (statNew != null) {
      const storedStat = this.#options.converter
        ? await this.#options.converter.to(statNew)
        : (statNew as unknown as StatStored)
      await this.#options.storage.set(key, storedStat)

      const statOld = this.#statsMap.get(key)
      this.#statsMap.set(key, statNew)
      this.#totalSize += statNew.size - (statOld?.size ?? 0)
    } else {
      await this.#options.storage.delete(key)

      const statOld = this.#statsMap.get(key)
      if (statOld != null) {
        this.#statsMap.delete(key)
        this.#totalSize -= statOld.size
      }
    }
  }

  async getEntries(): Promise<ReadonlyMap<Key, Stat>> {
    await this.init()
    return this.#statsMap
  }
}

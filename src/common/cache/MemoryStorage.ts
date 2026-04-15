import type { PromiseLikeOrValue } from '@flemist/async-utils'
import type { IStorageDb } from './types'

export class MemoryStorage<Key, Value> implements IStorageDb<Key, Value> {
  private readonly _cache: Map<Key, Value> = new Map()

  set<T extends Value>(key: Key, value: T): PromiseLikeOrValue<void> {
    this._cache.set(key, value)
  }

  get<T extends Value>(key: Key): PromiseLikeOrValue<T | undefined> {
    const value = this._cache.get(key) as T | undefined
    return value
  }

  delete(key: Key): PromiseLikeOrValue<void> {
    this._cache.delete(key)
  }

  clear(): PromiseLikeOrValue<void> {
    this._cache.clear()
  }

  getKeys(): PromiseLikeOrValue<Key[]> {
    return Array.from(this._cache.keys())
  }

  getEntries(): PromiseLikeOrValue<Map<Key, Value>> {
    return new Map(this._cache)
  }
}

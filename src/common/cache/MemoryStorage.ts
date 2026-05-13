import type { PromiseLikeOrValue } from 'src/common/types/common'
import type { IStorageDb } from './types'

export class MemoryStorage<Key, Value> implements IStorageDb<Key, Value> {
  readonly #cache: Map<Key, Value> = new Map()

  set<T extends Value>(key: Key, value: T): PromiseLikeOrValue<void> {
    this.#cache.set(key, value)
  }

  get<T extends Value>(key: Key): PromiseLikeOrValue<T | undefined> {
    const value = this.#cache.get(key) as T | undefined
    return value
  }

  delete(key: Key): PromiseLikeOrValue<void> {
    this.#cache.delete(key)
  }

  clear(): PromiseLikeOrValue<void> {
    this.#cache.clear()
  }

  getKeys(): PromiseLikeOrValue<Key[]> {
    return Array.from(this.#cache.keys())
  }

  getEntries(): PromiseLikeOrValue<Map<Key, Value>> {
    return new Map(this.#cache)
  }
}

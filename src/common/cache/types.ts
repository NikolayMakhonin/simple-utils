import {
  type PromiseLikeOrValue,
  type PromiseOrValue,
} from '@flemist/async-utils'

export type IStorage<Key, Value> = {
  set(key: Key, value: Value): PromiseLikeOrValue<void>
  get(key: Key): PromiseLikeOrValue<Value | undefined>
  delete(key: Key): PromiseLikeOrValue<void>
  getKeys(): PromiseLikeOrValue<Key[]>
}

export type IStorageDb<Key, Value> = IStorage<Key, Value> & {
  getEntries(): PromiseLikeOrValue<ReadonlyMap<Key, Value>>
}

export type ICache<Input, Value> = {
  getOrCreate: <T extends Value>(
    input: Input,
    func: (input: Input) => PromiseLikeOrValue<T>,
  ) => PromiseOrValue<T>

  delete(input: Input): PromiseOrValue<void>

  clear(): PromiseOrValue<void>
}

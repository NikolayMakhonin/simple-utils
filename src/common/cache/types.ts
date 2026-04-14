// import { type PromiseLikeOrValue } from '@flemist/async-utils'
// import type { ConverterAsync } from '../converter'
// import { getNormalizedObject } from '../object'
// import { sha256 } from '../crypto'
//
// export type ICache<Input, Output, Key, OutputStored, ErrorStored> = {
//   getOrSet: <Value extends Output>(
//     input: Input,
//     func: (input: Input) => PromiseLikeOrValue<Value>,
//     options?: null | CacheOptions<
//       Input,
//       Output,
//       Key,
//       OutputStored,
//       ErrorStored
//     >,
//   ) => Promise<Value>
// }
//
// export type CacheOptions<Input, Output, Key, OutputStored, ErrorStored> = {
//   converterInput?: null | ConverterAsync<Output, OutputStored>
//   converterOutput?: null | ConverterAsync<Input, Key>
//   converterError?: null | ConverterAsync<any, ErrorStored>
// }
//
// export function getJsonKey<T>(obj: T) {
//   obj = getNormalizedObject(obj)
//   return JSON.stringify(obj ?? null)
// }
//
// export function getHashKey(obj?: any): string {
//   const json = getJsonKey(obj)
//   return sha256(json)
// }
//
// export type CacheValue<Value> = {
//   value: Value | undefined | null
//   error: any
//   hasError: boolean
// }
//
// export type CacheStat = {
//   dateCreated: number
//   dateUsed: number
// }
//
// export type ICacheStorage<Key, Output> = {
//   set<Value extends Output>(
//     key: Key,
//     value: CacheValue<Value>,
//   ): PromiseLikeOrValue<void>
//   get<Value extends Output>(
//     key: Key,
//   ): PromiseLikeOrValue<CacheValue<Value> | null>
// }
//
// export type MemoryCacheStorageOptions = {}
//
// export class MemoryCacheStorage<Key, Output>
//   implements ICacheStorage<Key, Output>
// {
//   private readonly _cache: Map<Key, CacheValue<Output>> = new Map()
//
//   constructor(options: MemoryCacheStorageOptions) {}
//
//   set<Value extends Output>(
//     key: Key,
//     value: CacheValue<Value>,
//   ): PromiseLikeOrValue<void> {
//     this._cache.set(key, value)
//   }
//
//   get<Value extends Output>(
//     key: Key,
//   ): PromiseLikeOrValue<CacheValue<Value> | null> {
//     const value = this._cache.get(key) as CacheValue<Value> | undefined
//     return value ?? null
//   }
// }

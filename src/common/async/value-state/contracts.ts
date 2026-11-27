import type { PromiseLikeOrValue } from 'src/common/types/common'
import type { ValueState } from './ValueState'

export interface IValueState<TValue> {
  value?: TValue
  loading?: null | boolean
  hasValue?: null | boolean
  error?: any
  hasError?: null | boolean
}

export type ValueStateOrValue<T> = ValueState<T> | T
export type FuncOrValue<TValue> = (() => TValue) | TValue
export type StateOrValue<TValue> = ValueState<TValue> | TValue
export type AsyncOrValue<TValue> = FuncOrValue<
  PromiseLikeOrValue<StateOrValue<TValue>>
>
export type OfValueStateOrValue<T> =
  T extends ValueStateOrValue<infer U> ? U : never
export type OfValueStateOrValues<T> = {
  [K in keyof T]: OfValueStateOrValue<T[K]>
}
export type ValueStateUpdater<T> = (updater: (value: T) => T) => void

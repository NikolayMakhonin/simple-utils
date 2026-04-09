import type { PromiseOrValue, Unsubscribe } from 'src/common/types/common'
import type { ValueState } from '@flemist/async-utils'

export type Listener<T = void> = (event: T) => PromiseOrValue<void>

export interface IObservable<T = void> {
  subscribe(listener: Listener<T>): Unsubscribe
}

export interface IEmitter<T = void> {
  emit(event: T): PromiseOrValue<void>
}

export interface ISubject<T = void> extends IObservable<T>, IEmitter<T> {}

export interface IObservableWithId<Id, T = void> {
  subscribe(id: Id, listener: Listener<T>): Unsubscribe
  observable(id: Id): IObservable<T>
}

export interface IEmitterWithId<Id, T = void> {
  emit(id: Id, event: T): PromiseOrValue<void>
  forEach(callback: (emitter: IEmitter<T>, id: Id) => void): void
  emitter(id: Id): IEmitter<T>
}

export interface ISubjectWithId<Id, T = void>
  extends IObservableWithId<Id, T>,
    IEmitterWithId<Id, T> {
  subject(id: Id): ISubject<T>
}

export type ObservableValueState<T> = IObservable<ValueState<T>>

export type OfObservable<T> = T extends IObservable<infer U> ? U : never

export type ObservableOrValue<T = void> = IObservable<T> | T

export type Stores =
  | [ObservableOrValue<any>, ...Array<ObservableOrValue<any>>]
  | Array<ObservableOrValue<any>>

export type StoresValues<T> = {
  [K in keyof T]: T[K] extends ObservableOrValue<infer U> ? U : T[K]
}

export type Observables<T> = {
  [K in keyof T]: T[K] extends IObservable<any> ? T[K] : IObservable<T[K]>
}

export type DerivedOrValueFunc<Value, T> = (
  value: Value,
) => ObservableOrValue<T>

export type DerivedOrValuesFunc<S extends Stores, T> = (
  values: StoresValues<S>,
) => ObservableOrValue<T>

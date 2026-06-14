import type { PromiseOrValue, Unsubscribe } from 'src/common/types/common'
import type { ValueState } from 'src/common/async/value-state/ValueState'

/** Called when the observable value becomes stale */
export type Invalidate = () => void

export type Listener<T = void> = (event: T) => PromiseOrValue<void>

export interface IObservable<T = void> {
  subscribe(listener: Listener<T>, invalidate?: null | Invalidate): Unsubscribe
}

export interface IEmitter<T = void> {
  emit(event: T): PromiseOrValue<void>
}

export interface ISubject<From = void, To = From>
  extends IObservable<From>,
    IEmitter<To> {}

/** Action to perform on circular subscription or emit */
export type ActionOnCircular = 'emitLast' | 'throw' | false
export type Emit<T> = (value: T) => PromiseOrValue<void>
export type Updater<T> = (event: T) => T
export type Update<T> = (updater: Updater<T>) => PromiseOrValue<void>
export type StartStopNotifier<T> = (
  emit: Emit<T>,
  update: Update<T>,
  invalidate: Invalidate,
) => void | Unsubscribe

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

export type UnwrapObservable<T> = T extends IObservable<infer U> ? U : T

export type UnwrapObservableOrValue<T> =
  T extends ObservableOrValue<infer U> ? U : T

export type ObservableOrValue<T = void> = IObservable<T> | T

export type Stores =
  | [ObservableOrValue<any>, ...Array<ObservableOrValue<any>>]
  | Array<ObservableOrValue<any>>

export type StoresValues<T> = {
  [K in keyof T]: UnwrapObservableOrValue<T[K]>
}

export type Observables<T> = {
  [K in keyof T]: T[K] extends IObservable<any> ? T[K] : IObservable<T[K]>
}

/** Must be pure */
export type DerivedFuncSync<S extends Stores, T> = (
  values: StoresValues<S>,
) => T
export type DerivedFuncAsync<S extends Stores, T> = (
  values: StoresValues<S>,
  emit: Emit<T>,
  update: Update<T>,
  invalidate: Invalidate,
) => Unsubscribe | void
export type DerivedFunc<S extends Stores, T> =
  | DerivedFuncSync<S, T>
  | DerivedFuncAsync<S, T>

export type DerivedOrValueFunc<Value, T> = (
  value: Value,
) => ObservableOrValue<T>

export type DerivedOrValuesFunc<S extends Stores, T> = (
  values: StoresValues<S>,
) => ObservableOrValue<T>

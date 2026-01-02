export type Obj = Record<string, any>

export type PartialWithNull<T, Keys extends keyof T = keyof T> = {
  [P in Keys]?: T[P] | null
} & Omit<T, Keys>

export type RequiredNonNullable<T, Keys extends keyof T = keyof T> = {
  [P in Keys]-?: NonNullable<T[P]>
} & Omit<T, Keys>

export type NumberRangeOptional = [
  from: number | undefined | null,
  to: number | undefined | null,
]

export type NumberRange = [from: number, to: number]

export type PromiseOrValue<T> = T | Promise<T>

export type Unsubscribe = () => void

export type Func<This, Args extends any[], Result> = (
  this: This,
  ...args: Args
) => Result

export type Mutable<T> = {
  -readonly [P in keyof T]: T[P]
}

export type Ref<T> = { value: T }

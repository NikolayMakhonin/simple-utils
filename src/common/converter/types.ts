import type { PromiseOrValue } from 'src/common/types/common'

export type Correct<T> = (value: T) => T
export type CorrectWithDefault<T> = (value: T, correctDefault: Correct<T>) => T

export type ConvertTo<From, To> = (from: From) => To
export type ConvertFrom<From, To> = (to: To) => From

export type ConverterTo<From, To> = {
  to: ConvertTo<From, To>
}
export type ConverterFrom<From, To> = {
  from: ConvertFrom<From, To>
}

/** ToFrom => (ToTo ... FromTo) => FromFrom */
export type Converter<
  ToFrom,
  ToTo,
  FromTo = ToTo,
  FromFrom = ToFrom,
> = ConverterTo<ToFrom, ToTo> & ConverterFrom<FromFrom, FromTo>

export type ConvertWithDefaultTo<From, To> = (
  from: From,
  convertDefault: ConvertTo<From, To>,
) => To
export type ConvertWithDefaultFrom<From, To> = (
  to: To,
  convertDefault: ConvertFrom<From, To>,
) => From
export type ConverterWithDefaultTo<From, To> = {
  to: ConvertWithDefaultTo<From, To>
}
export type ConverterWithDefaultFrom<From, To> = {
  from: ConvertWithDefaultFrom<From, To>
}
export type ConverterWithDefault<
  ToFrom,
  ToTo,
  FromTo = ToTo,
  FromFrom = ToFrom,
> = ConverterWithDefaultTo<ToFrom, ToTo> &
  ConverterWithDefaultFrom<FromFrom, FromTo>

// Async

export type ConvertToAsync<From, To> = (from: From) => PromiseOrValue<To>
export type ConvertFromAsync<From, To> = (to: To) => PromiseOrValue<From>

export type ConverterToAsync<From, To> = {
  to: ConvertToAsync<From, To>
}
export type ConverterFromAsync<From, To> = {
  from: ConvertFromAsync<From, To>
}
/** ToFrom => (ToTo ... FromTo) => FromFrom */
export type ConverterAsync<
  ToFrom,
  ToTo,
  FromTo = ToTo,
  FromFrom = ToFrom,
> = ConverterToAsync<ToFrom, ToTo> & ConverterFromAsync<FromFrom, FromTo>

export type ConvertWithDefaultToAsync<From, To> = (
  from: From,
  convertDefault: ConvertToAsync<From, To>,
) => PromiseOrValue<To>
export type ConvertWithDefaultFromAsync<From, To> = (
  to: To,
  convertDefault: ConvertFromAsync<From, To>,
) => PromiseOrValue<From>
export type ConverterWithDefaultToAsync<From, To> = {
  to: ConvertWithDefaultToAsync<From, To>
}
export type ConverterWithDefaultFromAsync<From, To> = {
  from: ConvertWithDefaultFromAsync<From, To>
}
export type ConverterWithDefaultAsync<
  ToFrom,
  ToTo,
  FromTo = ToTo,
  FromFrom = ToFrom,
> = ConverterWithDefaultToAsync<ToFrom, ToTo> &
  ConverterWithDefaultFromAsync<FromFrom, FromTo>

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
export type Converter<From, To> = ConverterTo<From, To> &
  ConverterFrom<From, To>

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
export type ConverterWithDefault<From, To> = ConverterWithDefaultTo<From, To> &
  ConverterWithDefaultFrom<From, To>

// Async

export type ConvertToAsync<From, To> = (from: From) => PromiseOrValue<To>
export type ConvertFromAsync<From, To> = (to: To) => PromiseOrValue<From>

export type ConverterToAsync<From, To> = {
  to: ConvertToAsync<From, To>
}
export type ConverterFromAsync<From, To> = {
  from: ConvertFromAsync<From, To>
}
export type ConverterAsync<From, To> = ConverterToAsync<From, To> &
  ConverterFromAsync<From, To>

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
export type ConverterWithDefaultAsync<From, To> = ConverterWithDefaultToAsync<
  From,
  To
> &
  ConverterWithDefaultFromAsync<From, To>

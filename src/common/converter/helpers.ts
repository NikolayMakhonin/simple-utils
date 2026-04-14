import type {
  Correct,
  CorrectWithDefault,
  ConvertWithDefaultTo,
  ConvertWithDefaultFrom,
  ConverterWithDefaultTo,
  ConverterWithDefaultFrom,
  ConverterWithDefault,
  ConvertTo,
  ConvertFrom,
  ConverterTo,
  ConverterFrom,
  Converter,
} from './types'

export function toCorrectWithDefault<T>(
  correct: CorrectWithDefault<T> | undefined | null,
  correctDefault: CorrectWithDefault<T>,
): CorrectWithDefault<T> {
  if (correct == null) {
    return correctDefault
  }
  return (value, _correctDefault) => {
    return correct(value, o => correctDefault(o, _correctDefault))
  }
}

export function toCorrect<T>(
  correct: CorrectWithDefault<T> | undefined | null,
  correctDefault: Correct<T>,
): Correct<T> {
  if (correct == null) {
    return correctDefault
  }
  return value => {
    return correct(value, o => correctDefault(o))
  }
}

export function toConvertWithDefaultTo<From, To>(
  converter: ConvertWithDefaultTo<From, To> | undefined | null,
  convertDefault: ConvertWithDefaultTo<From, To>,
): ConvertWithDefaultTo<From, To> {
  if (converter == null) {
    return convertDefault
  }
  return (from, _convertDefault) => {
    return converter(from, o => convertDefault(o, _convertDefault))
  }
}

export function toConvertWithDefaultFrom<From, To>(
  converter: ConvertWithDefaultFrom<From, To> | undefined | null,
  convertDefault: ConvertWithDefaultFrom<From, To>,
): ConvertWithDefaultFrom<From, To> {
  if (converter == null) {
    return convertDefault
  }
  return (to, _convertDefault) => {
    return converter(to, o => convertDefault(o, _convertDefault))
  }
}

export function toConverterWithDefaultTo<From, To>(
  converter: ConverterWithDefaultTo<From, To> | undefined | null,
  converterDefault: ConverterWithDefaultTo<From, To>,
): ConverterWithDefaultTo<From, To> {
  if (converter == null) {
    return converterDefault
  }
  return {
    to: toConvertWithDefaultTo(
      (o, d) => converter.to(o, d),
      (o, d) => converterDefault.to(o, d),
    ),
  }
}

export function toConverterWithDefaultFrom<From, To>(
  converter: ConverterWithDefaultFrom<From, To>,
  converterDefault: ConverterWithDefaultFrom<From, To>,
): ConverterWithDefaultFrom<From, To> {
  if (converter == null) {
    return converterDefault
  }
  return {
    from: toConvertWithDefaultFrom(
      (o, d) => converter.from(o, d),
      (o, d) => converterDefault.from(o, d),
    ),
  }
}

export function toConverterWithDefault<From, To>(
  converter: ConverterWithDefault<From, To> | undefined | null,
  converterDefault: ConverterWithDefault<From, To>,
): ConverterWithDefault<From, To> {
  if (converter == null) {
    return converterDefault
  }
  return {
    to: toConverterWithDefaultTo(converter, converterDefault).to,
    from: toConverterWithDefaultFrom(converter, converterDefault).from,
  }
}

export function toConvertTo<From, To>(
  converter: ConvertWithDefaultTo<From, To> | undefined | null,
  convertDefault: ConvertTo<From, To>,
): ConvertTo<From, To> {
  if (converter == null) {
    return convertDefault
  }
  return (from: From) => {
    return converter(from, o => convertDefault(o))
  }
}

export function toConvertFrom<From, To>(
  converter: ConvertWithDefaultFrom<From, To> | undefined | null,
  convertDefault: ConvertFrom<From, To>,
): ConvertFrom<From, To> {
  if (converter == null) {
    return convertDefault
  }
  return (to: To) => {
    return converter(to, o => convertDefault(o))
  }
}

export function toConverterTo<From, To>(
  converter: ConverterWithDefaultTo<From, To> | undefined | null,
  converterDefault: ConverterTo<From, To>,
): ConverterTo<From, To> {
  if (converter == null) {
    return converterDefault
  }
  return {
    to: toConvertTo(
      (o, d) => converter.to(o, d),
      o => converterDefault.to(o),
    ),
  }
}

export function toConverterFrom<From, To>(
  converter: ConverterWithDefaultFrom<From, To>,
  converterDefault: ConverterFrom<From, To>,
): ConverterFrom<From, To> {
  if (converter == null) {
    return converterDefault
  }
  return {
    from: toConvertFrom(
      (o, d) => converter.from(o, d),
      o => converterDefault.from(o),
    ),
  }
}

export function toConverter<From, To>(
  converter: ConverterWithDefault<From, To> | undefined | null,
  converterDefault: Converter<From, To>,
): Converter<From, To> {
  if (converter == null) {
    return converterDefault
  }
  return {
    to: toConverterTo(converter, converterDefault).to,
    from: toConverterFrom(converter, converterDefault).from,
  }
}

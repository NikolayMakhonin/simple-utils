import { describe, it, expect } from 'vitest'
import { toConverterFrom, toConverterWithDefaultFrom } from './helpers'

describe('toConverterFrom', () => {
  const converterDefault = { from: (to: number) => String(to) }

  it('returns converterDefault when converter is null', () => {
    expect(toConverterFrom(null, converterDefault)).toBe(converterDefault)
    expect(toConverterFrom(undefined, converterDefault)).toBe(converterDefault)
  })

  it('converter.from receives converterDefault.from', () => {
    const converter = toConverterFrom<string, number>(
      { from: (to, convertDefault) => `${convertDefault(to)}!` },
      converterDefault,
    )
    expect(converter.from(1)).toBe('1!')
  })
})

describe('toConverterWithDefaultFrom', () => {
  const converterDefault = {
    from: (to: number, convertDefault: (to: number) => string) =>
      `${convertDefault(to)}?`,
  }

  it('returns converterDefault when converter is null', () => {
    expect(toConverterWithDefaultFrom(null, converterDefault)).toBe(
      converterDefault,
    )
    expect(toConverterWithDefaultFrom(undefined, converterDefault)).toBe(
      converterDefault,
    )
  })

  it('chains converter.from → converterDefault.from → the default of the call', () => {
    const converter = toConverterWithDefaultFrom<string, number>(
      { from: (to, convertDefault) => `${convertDefault(to)}!` },
      converterDefault,
    )
    expect(converter.from(1, String)).toBe('1?!')
  })
})

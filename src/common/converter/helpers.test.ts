import { describe, it, expect } from 'vitest'
import { toConverterFrom, toConverterWithDefaultFrom } from './helpers'

describe('toConverterFrom', () => {
  const converterDefault = { from: (to: number) => String(to) }

  it('without converter', () => {
    expect(toConverterFrom(null, converterDefault)).toBe(converterDefault)
    expect(toConverterFrom(undefined, converterDefault)).toBe(converterDefault)
  })

  it('converter receives the default', () => {
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

  it('without converter', () => {
    expect(toConverterWithDefaultFrom(null, converterDefault)).toBe(
      converterDefault,
    )
    expect(toConverterWithDefaultFrom(undefined, converterDefault)).toBe(
      converterDefault,
    )
  })

  it('converter receives the default chain', () => {
    const converter = toConverterWithDefaultFrom<string, number>(
      { from: (to, convertDefault) => `${convertDefault(to)}!` },
      converterDefault,
    )
    expect(converter.from(1, String)).toBe('1?!')
  })
})

import { describe, it, expect } from 'vitest'
import { truncateString, type TruncateStringOptions } from './truncateString'

const EMOJI = '😀'

describe('truncateString', () => {
  function test(
    str: string | null | undefined,
    maxLength: number | null | undefined,
    options: null | TruncateStringOptions,
    expected: string | null,
  ) {
    const result = truncateString(str, maxLength, options)
    expect(result).toBe(expected)
    if (result != null && maxLength != null) {
      expect(result.length).toBeLessThanOrEqual(Math.max(0, maxLength))
    }
  }

  it('base', () => {
    test(null, 1, null, null)
    test(undefined, 1, null, null)
    test('', 0, null, '')
    test('abc', null, null, 'abc')
    test('abc', undefined, null, 'abc')
    test('abc', 3, null, 'abc')
    test('abc', 4, null, 'abc')
    test('abc', 2, null, 'ab')
    test('abc', 0, null, '')
    test('abc', -1, null, '')
  })

  it('fromStart', () => {
    const options = { fromStart: true }
    test('abc', 3, options, 'abc')
    test('abc', 2, options, 'bc')
    test('abc', 0, options, '')
    test('abc', -1, options, '')
  })

  it('appendEllipsis', () => {
    const options = { appendEllipsis: true }
    test('abc', 3, options, 'abc')
    test('abcdef', 3, options, 'ab…')
    test('abcdef', 1, options, '…')
    test('abcdef', 3, { ...options, fromStart: true }, '…ef')
  })

  it('appendTruncatedLength', () => {
    const options = { appendTruncatedLength: true }
    test('abc', 3, options, 'abc')
    test('abcdefgh', 6, options, 'abc(5)')
    test('abcdefgh', 3, options, '(8)')
    test('abcdefgh', 6, { ...options, fromStart: true }, '(5)fgh')
    test('abcdefghij', 8, options, 'abcd(6)')
  })

  it('appendEllipsis and appendTruncatedLength', () => {
    const options = { appendEllipsis: true, appendTruncatedLength: true }
    test('abcdefgh', 6, options, 'ab…(6)')
    test('abcdefgh', 4, options, '…(8)')
    test('abcdefgh', 6, { ...options, fromStart: true }, '(6)…gh')
  })

  it('omits the ellipsis and the truncated length when they do not fit', () => {
    test('abcdefgh', 0, { appendEllipsis: true }, '')
    test('abcdefgh', 2, { appendTruncatedLength: true }, 'ab')
    test('ab', 1, { appendEllipsis: true, appendTruncatedLength: true }, 'a')
    test(
      'abcdefgh',
      2,
      { appendEllipsis: true, appendTruncatedLength: true, fromStart: true },
      'gh',
    )
  })

  it('surrogate pairs', () => {
    const str = `a${EMOJI}b`
    test(str, 3, null, `a${EMOJI}`)
    test(str, 2, null, 'a')
    test(str, 1, null, 'a')
    test(str, 3, { fromStart: true }, `${EMOJI}b`)
    test(str, 2, { fromStart: true }, 'b')
    test(str, 1, { fromStart: true }, 'b')

    test(EMOJI, 1, null, '')
    test(EMOJI, 1, { fromStart: true }, '')

    test(`a${EMOJI}bcdefgh`, 6, { appendTruncatedLength: true }, 'a(9)')
    test(
      `abcdefg${EMOJI}h`,
      6,
      { appendTruncatedLength: true, fromStart: true },
      '(9)h',
    )
  })

  it('lone surrogates', () => {
    test('a\ud83d', 1, null, 'a')
    test('a\ud83db', 2, null, 'a')
    test('a\udc00b', 2, { fromStart: true }, 'b')
  })
})

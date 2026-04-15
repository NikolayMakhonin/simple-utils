import { describe, it, expect } from 'vitest'
import {
  createConverterSubPath,
  type CacheConverterSubPathOptions,
} from './createConverterSubPath'

describe('createConverterSubPath', () => {
  function testTo(
    options: CacheConverterSubPathOptions,
    key: string,
    expected: string,
  ) {
    const converter = createConverterSubPath(options)
    expect(converter.to(key)).toBe(expected)
  }

  function testFrom(
    options: CacheConverterSubPathOptions,
    subPath: string,
    expected: string | null,
  ) {
    const converter = createConverterSubPath(options)
    expect(converter.from(subPath)).toBe(expected)
  }

  function testRoundTrip(
    options: CacheConverterSubPathOptions,
    key: string,
    expectedSubPath: string,
  ) {
    const converter = createConverterSubPath(options)
    const subPath = converter.to(key)
    expect(subPath).toBe(expectedSubPath)
    expect(converter.from(subPath)).toBe(key)
  }

  it('base', () => {
    testRoundTrip({}, '', '')
    testRoundTrip({}, 'a', 'a')
    testRoundTrip({}, 'abc', 'abc')

    testRoundTrip({ prefix: 'p' }, '', 'p')
    testRoundTrip({ prefix: 'p' }, 'a', 'pa')
    testRoundTrip({ prefix: 'p' }, 'abc', 'pabc')

    testRoundTrip({ suffix: 's' }, '', 's')
    testRoundTrip({ suffix: 's' }, 'a', 'as')
    testRoundTrip({ suffix: 's' }, 'abc', 'abcs')

    testRoundTrip({ prefix: 'p', suffix: 's' }, '', 'ps')
    testRoundTrip({ prefix: 'p', suffix: 's' }, 'a', 'pas')
    testRoundTrip({ prefix: 'p', suffix: 's' }, 'abc', 'pabcs')

    testRoundTrip({ splitKeyLetters: 1 }, '', '')
    testRoundTrip({ splitKeyLetters: 1 }, 'a', 'a')
    testRoundTrip({ splitKeyLetters: 1 }, 'ab', 'a/b')
    testRoundTrip({ splitKeyLetters: 1 }, 'abc', 'a/bc')

    testRoundTrip({ splitKeyLetters: 2 }, '', '')
    testRoundTrip({ splitKeyLetters: 2 }, 'a', 'a')
    testRoundTrip({ splitKeyLetters: 2 }, 'ab', 'a/b')
    testRoundTrip({ splitKeyLetters: 2 }, 'abc', 'a/b/c')

    testRoundTrip({ splitKeyLetters: 2, prefix: 'p' }, 'abc', 'pa/b/c')
    testRoundTrip({ splitKeyLetters: 2, suffix: 's' }, 'abc', 'a/b/cs')
    testRoundTrip(
      { splitKeyLetters: 2, prefix: 'p', suffix: 's' },
      'abc',
      'pa/b/cs',
    )

    testRoundTrip(
      { splitKeyLetters: 2, prefix: 'p/p', suffix: 's/s' },
      'abc',
      'p/pa/b/cs/s',
    )
    testRoundTrip(
      { splitKeyLetters: 2, prefix: '/p/p/', suffix: '/s/s/' },
      'abc',
      '/p/p/a/b/c/s/s/',
    )
    testRoundTrip(
      { splitKeyLetters: 2, prefix: 'p\\p', suffix: 's\\s' },
      'abc',
      'p/pa/b/cs/s',
    )
    testRoundTrip(
      { splitKeyLetters: 2, prefix: '\\p\\p\\', suffix: '\\s\\s\\' },
      'abc',
      '/p/p/a/b/c/s/s/',
    )
    testRoundTrip(
      {
        splitKeyLetters: 2,
        prefix: '/\\/\\p/\\/\\p/\\/\\',
        suffix: '/\\/\\s/\\/\\s/\\/\\',
      },
      'abc',
      '/p/p/a/b/c/s/s/',
    )
    testRoundTrip(
      {
        splitKeyLetters: 0,
        prefix: '/\\/\\p/\\/\\p/\\/\\',
        suffix: '/\\/\\s/\\/\\s/\\/\\',
      },
      '',
      '/p/p/s/s/',
    )
    testRoundTrip(
      {
        splitKeyLetters: 2,
        prefix: '/\\/\\p/\\/\\p/\\/\\',
        suffix: '/\\/\\s/\\/\\s/\\/\\',
      },
      '',
      '/p/p/s/s/',
    )
  })

  it('nullish options equal defaults', () => {
    testRoundTrip(
      { prefix: null, suffix: null, splitKeyLetters: null },
      'abc',
      'abc',
    )
    testRoundTrip(
      { prefix: undefined, suffix: undefined, splitKeyLetters: undefined },
      'abc',
      'abc',
    )
  })

  it('splitKeyLetters non-positive behaves as no split', () => {
    testRoundTrip({ splitKeyLetters: 0 }, 'abcdef', 'abcdef')
    testRoundTrip({ splitKeyLetters: -1 }, 'abcdef', 'abcdef')
    testRoundTrip(
      { prefix: 'p', suffix: 's', splitKeyLetters: 0 },
      'abcdef',
      'pabcdefs',
    )
  })

  it('from returns null for subPath not matching prefix or suffix', () => {
    testFrom({ prefix: 'p', suffix: 's' }, 'xabcs', null)
    testFrom({ prefix: 'p', suffix: 's' }, 'pabcx', null)
    testFrom({ prefix: 'p', suffix: 's' }, '', null)
    testFrom({ prefix: 'p' }, 'xabc', null)
    testFrom({ suffix: 's' }, 'abcx', null)
  })

  it('from returns null in split mode when suffix missing', () => {
    testFrom(
      { prefix: 'p', suffix: 's', splitKeyLetters: 2 },
      'p/a/b/cdef',
      null,
    )
    testFrom(
      { prefix: 'p', suffix: 's', splitKeyLetters: 2 },
      'p/a/b/cdefx',
      null,
    )
  })
})

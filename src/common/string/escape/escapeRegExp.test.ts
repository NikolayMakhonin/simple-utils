import { describe, it, expect } from 'vitest'
import { escapeRegExp } from './escapeRegExp'

describe('escapeRegExp', () => {
  function test(text: string) {
    expect(new RegExp(`^${escapeRegExp(text)}$`).test(text)).toBe(true)
    expect(new RegExp(`^${escapeRegExp(text)}$`, 'u').test(text)).toBe(true)
  }

  it('base', () => {
    const nullable: string | null = null as string | null
    expect(escapeRegExp(nullable)).toBe(null)
    expect(escapeRegExp(undefined)).toBe(null)
    expect(escapeRegExp('')).toBe('')
    expect(escapeRegExp('abc')).toBe('abc')
  })

  it('special characters match literally, also with the u flag', () => {
    test('/\\^$*+?.()|[]{}')
    test('a.b')
    test('(a|b)*')
    test('[a-z]')
  })

  it('escaped special characters do not match other text', () => {
    expect(new RegExp(escapeRegExp('a.b')).test('axb')).toBe(false)
    expect(new RegExp(escapeRegExp('a*')).test('aa')).toBe(false)
    expect(new RegExp(escapeRegExp('[a]')).test('a')).toBe(false)
  })
})

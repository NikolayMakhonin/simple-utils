import { describe, it, expect } from 'vitest'
import { converterStringToBuffer } from './converterStringToBuffer'

describe('converterStringToBuffer', () => {
  function test(value: string, bytes: number[]) {
    const buffer = converterStringToBuffer.to(value)
    expect(Array.from(buffer)).toEqual(bytes)
    expect(converterStringToBuffer.from(buffer)).toBe(value)
  }

  it('base', () => {
    test('', [])
    test('a', [0x61])
    test('я', [0xd1, 0x8f])
    test('€', [0xe2, 0x82, 0xac])
    test('😀', [0xf0, 0x9f, 0x98, 0x80])
  })

  it('a leading BOM stays', () => {
    test('\ufeffa', [0xef, 0xbb, 0xbf, 0x61])
    test('\ufeff\ufeff', [0xef, 0xbb, 0xbf, 0xef, 0xbb, 0xbf])
  })

  it('invalid bytes throw instead of changing the value', () => {
    const { from } = converterStringToBuffer
    expect(() => from(new Uint8Array([0xff]))).toThrow()
    expect(() => from(new Uint8Array([0x61, 0xc0, 0x80]))).toThrow()
    expect(() => from(new Uint8Array([0xe2, 0x82]))).toThrow()
    expect(from(new Uint8Array([0x61]))).toBe('a')
  })
})

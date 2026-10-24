import { describe, it, expect } from 'vitest'
import { hexToRgba } from './rgbaToHex'

describe('hexToRgba', () => {
  function test(value: string, expected: string) {
    expect(hexToRgba(value)).toBe(expected)
  }

  it('base', () => {
    test('', '')
    test('red', 'red')
    test('#', '#')
    test('#ff', '#ff')
    test('#fff', '#fff')
    test('#FFF', '#FFF')
    test('#ffff', 'rgba(255, 255, 255, 1)')
    test('#f00f', 'rgba(255, 0, 0, 1)')
    test('#ff0000', '#ff0000')
    test('#1234567', '#1234567')
    test('#ff000000', 'rgba(255, 0, 0, 0)')
    test('#ff0000ff', 'rgba(255, 0, 0, 1)')
    test('#123456789', '#123456789')
  })

  it('alpha suffix', () => {
    test('#fff/50', 'rgba(255, 255, 255, 0.5)')
    test('#ABC/5', 'rgba(170, 187, 204, 0.05)')
    test('#ff0000/100', 'rgba(255, 0, 0, 1)')
    test('#ff0000/0', 'rgba(255, 0, 0, 0)')
    test('#fff/', '#fff/')
    test('#fff/50x', '#fff/50x')
  })

  it('boundaries', () => {
    test('#fffg', '#fffg')
    test('a#fff/50', 'argba(255, 255, 255, 0.5)')
    test(
      'a #fff/50 b #000/0 c #1234567',
      'a rgba(255, 255, 255, 0.5) b rgba(0, 0, 0, 0) c #1234567',
    )
  })
})

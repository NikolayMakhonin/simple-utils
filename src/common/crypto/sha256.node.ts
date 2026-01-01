import { describe, it } from 'vitest'
import crypto from 'node:crypto'
import { sha256 } from './sha256'
import { sha256Node } from './sha256Node'

export function test(data: string | Uint8Array | number[] | null | undefined) {
  if (data instanceof Array) {
    data = new Uint8Array(data)
  }
  const customHash = sha256(data)
  const nativeHash = sha256Node(data)
  if (customHash !== nativeHash) {
    throw new Error(
      `Hash mismatch!\nCustom: ${customHash}\nNative: ${nativeHash}`,
    )
  }
}

describe('calcSha256', () => {
  it('base', () => {
    test(null)
    test(void 0)
    test('')
    test(' ')
    test('a')
    test('\0')
    test('\xff')
    test([])
    test([0])
    test([255])
    test([0, 1, 2, 253, 254, 255])
    test('Lorem ipsum dolor')
  })

  it('Boundary: 55, 56, 63, 64, 65 bytes', () => {
    ;[55, 56, 63, 64, 65].forEach(size => {
      const input = new Uint8Array(size).fill(0x41)
      test(input)
    })
  })

  it('Random data: 100 iterations with various lengths', () => {
    for (let i = 0; i < 10000; i++) {
      const len = Math.floor(Math.random() * (i % 100))
      const input = new Uint8Array(crypto.randomBytes(len))
      test(input)
    }
  })

  it('Large data: 2MB', () => {
    const input = new Uint8Array(2 * 1024 * 1024).fill(0x7a)
    test(input)
  })

  it.skip('Errors: Unsupported types', () => {
    // @ts-expect-error
    assert.throws(() => sha256(123), /Unsupported content type/)
    // @ts-expect-error
    assert.throws(() => sha256({}), /Unsupported content type/)
  })
})

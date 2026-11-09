import { describe, it, assert } from 'vitest'
import crypto from 'node:crypto'
import { sha256 } from './sha256'
import { sha256Node } from './sha256Node'

function test(data: string | Uint8Array | number[] | null | undefined) {
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

  it('Boundary: sizes at which the padding takes 1 or 2 blocks', () => {
    ;[55, 56, 63, 64, 65, 119, 120, 127, 128, 129].forEach(size => {
      const input = new Uint8Array(size).fill(0x41)
      test(input)
    })
  })

  it('Strings just below and above the length limit of STRING_BUFFER', () => {
    test('a'.repeat(21845))
    test('a'.repeat(21846))
    test('a'.repeat(65536))
    test('я'.repeat(21845))
    test('€'.repeat(21845))
    test('€'.repeat(21846))
    test('😀'.repeat(10922))
    test('😀'.repeat(10923))
  })

  it('Previous input does not affect the next hash', () => {
    test('a'.repeat(100000))
    test('abc')
    test(new Uint8Array(1000).fill(0xff))
    test(new Uint8Array(10))
  })

  it('Typed arrays and DataView over a part of an ArrayBuffer', () => {
    const bytes = new Uint8Array(200)
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = i
    }
    const expected = sha256Node(bytes.subarray(3, 150))
    assert.strictEqual(sha256(bytes.subarray(3, 150)), expected)
    assert.strictEqual(sha256(Buffer.from(bytes.subarray(3, 150))), expected)
    assert.strictEqual(sha256(new DataView(bytes.buffer, 3, 147)), expected)
    const words = new Uint16Array(bytes.buffer, 4, 50)
    assert.strictEqual(sha256(words), sha256Node(bytes.subarray(4, 104)))
  })

  it('Random data of various lengths', () => {
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

  it('Does not keep a buffer as large as the input after the call', () => {
    const bytes = new Uint8Array(8 * 1024 * 1024)
    let memoryBefore = process.memoryUsage().arrayBuffers
    sha256(bytes)
    assert.isBelow(
      process.memoryUsage().arrayBuffers - memoryBefore,
      bytes.length / 2,
    )

    const str = 'a'.repeat(4 * 1024 * 1024)
    memoryBefore = process.memoryUsage().arrayBuffers
    sha256(str)
    // The limit allows the copy that encode() makes (str.length bytes),
    // which is not collected yet when measured
    assert.isBelow(
      process.memoryUsage().arrayBuffers - memoryBefore,
      str.length * 2,
    )
  })

  it('Errors: Unsupported types', () => {
    // @ts-expect-error
    assert.throws(() => sha256(123), /Unsupported content type/)
    // @ts-expect-error
    assert.throws(() => sha256({}), /Unsupported content type/)
  })
})

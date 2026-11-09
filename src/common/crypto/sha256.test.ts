import { describe, it, expect } from 'vitest'
import { sha256, sha256Buffer } from './sha256'

// Reference SHA-256 hashes published by NIST
const HASH_EMPTY =
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
const HASH_ABC =
  'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
const HASH_TWO_BLOCKS =
  '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1'

describe('sha256', () => {
  function test(content: string, expected: string) {
    expect(sha256(content)).toBe(expected)
    expect(sha256(new TextEncoder().encode(content))).toBe(expected)
  }

  it('base', () => {
    expect(sha256(null)).toBe(null)
    expect(sha256(undefined)).toBe(null)
    test('', HASH_EMPTY)
    test('abc', HASH_ABC)
    test(
      'abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq',
      HASH_TWO_BLOCKS,
    )
  })

  it('sha256Buffer', () => {
    expect(sha256Buffer(null)).toBe(null)
    const result = sha256Buffer('abc')
    expect(result.length).toBe(32)
    expect(result[0]).toBe(0xba)
    expect(result[31]).toBe(0xad)
  })
})

// vitest test for compressGzip / decompressGzip / isGzipCompressed functions
import { describe, expect, it } from 'vitest'
import { compressGzip, type CompressLevel } from './compressGzip'
import { decompressGzip, isGzipCompressed } from './decompressGzip'
import { Random } from 'src/common/random/Random'
import { randomInt } from 'src/common/random/helpers'

async function test(data: Uint8Array, level: CompressLevel) {
  expect(isGzipCompressed(data)).toBe(false)
  const compressed = await compressGzip(data, { level })
  expect(isGzipCompressed(compressed)).toBe(compressed.length > 0)
  const decompressed = await decompressGzip(compressed)
  expect(isGzipCompressed(decompressed)).toBe(false)
  expect(decompressed).toEqual(data)
}

function randomUint8Array(rnd: Random, size: number): Uint8Array {
  const arr = new Uint8Array(size)
  for (let i = 0; i < size; i++) {
    arr[i] = randomInt(rnd, 0, 255)
  }
  return arr
}

describe('gzip', () => {
  it(
    'base',
    async () => {
      const rnd = new Random(0)
      for (let i = 0; i < 100; i++) {
        const data = randomUint8Array(rnd, i)
        for (let level = 0; level <= 9; level++) {
          await test(data, level as CompressLevel)
        }
      }
    },
    5 * 60 * 1000,
  )
})

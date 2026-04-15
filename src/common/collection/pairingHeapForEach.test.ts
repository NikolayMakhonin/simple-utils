import { describe, it, expect } from 'vitest'
import { pairingHeapForEach } from './pairingHeapForEach'
import { createTestVariants } from '@flemist/test-variants'
import { PairingHeap } from '@flemist/pairing-heap'

const testVariants = createTestVariants(({ count }: { count: number }) => {
  const pairingHeap = new PairingHeap<number>()
  const expected: number[] = []
  for (let i = 0; i < count; i++) {
    const value = Math.floor(Math.random() * count)
    pairingHeap.add(value)
    expected.push(value)
  }
  expected.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))

  const actual: number[] = []
  pairingHeapForEach(pairingHeap.getMinNode(), node => {
    actual.push(node.item)
  })

  expect(actual).toEqual(expected)
})

describe('pairingHeapForEach', () => {
  it('base', async () => {
    await testVariants({
      count: [0, 1, 2, 3, 4, 5, 10, 100],
    })({
      cycles: 10000,
    })
  })
})

import { describe, it, assert } from 'vitest'
import { waitMicrotasks } from './waitMicrotasks'

describe('waitMicrotasks', () => {
  it('stress', async () => {
    let resolvedActual = 0
    function createMicrotasksTree(levels: number, countPerLevel: number) {
      if (levels === 0) {
        resolvedActual++
        return 1
      }
      for (let i = 0; i < countPerLevel; i++) {
        Promise.resolve().then(() =>
          createMicrotasksTree(levels - 1, countPerLevel),
        )
      }
      return countPerLevel ** levels
    }
    for (let i = 0; i < 5; i++) {
      resolvedActual = 0
      const resolvedExpected = createMicrotasksTree(i, i)
      await waitMicrotasks()
      console.log('i', i)
      assert.strictEqual(resolvedActual, resolvedExpected)
    }
  })
})

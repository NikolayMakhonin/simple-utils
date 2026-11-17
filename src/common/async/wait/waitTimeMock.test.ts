import { describe, it, assert } from 'vitest'
import { TimeMock } from 'src/common/time/time'
import { waitTimeMock } from './waitTimeMock'
import { EMPTY_FUNC } from 'src/common/constants'

describe('waitTimeMock', () => {
  it('base', async () => {
    const timeMock = new TimeMock()
    // expect(timeMock.time()).toBe(1)
    assert.strictEqual(timeMock.time(), 1)
    await waitTimeMock(timeMock)
    // expect(timeMock.time()).toBe(1)
    assert.strictEqual(timeMock.time(), 1)

    timeMock.setTimeout(EMPTY_FUNC, 123)
    await waitTimeMock(timeMock)
    // expect(timeMock.time()).toBe(124)
    assert.strictEqual(timeMock.time(), 124)

    timeMock.setTime(1000)
    timeMock.setTimeout(EMPTY_FUNC, 5)
    timeMock.setTimeout(EMPTY_FUNC, 17)
    timeMock.setTimeout(EMPTY_FUNC, 11)
    timeMock.setTimeout(EMPTY_FUNC, 16)
    await waitTimeMock(timeMock)
    // expect(timeMock.time()).toBe(1017)
    assert.strictEqual(timeMock.time(), 1017)

    timeMock.setTime(2000)
    timeMock.setTimeout(EMPTY_FUNC, 5)
    timeMock.setTimeout(EMPTY_FUNC, 17)
    timeMock.setTimeout(EMPTY_FUNC, 11)
    timeMock.setTimeout(EMPTY_FUNC, 16)
    await Promise.all(Array.from({ length: 10 }, () => waitTimeMock(timeMock)))
    // expect(timeMock.time()).toBe(2017)
    assert.strictEqual(timeMock.time(), 2017)
  })

  it('stress', async () => {
    const timeMock = new TimeMock()
    let resolvedActual = 0
    let maxTime = 1
    function createMicrotasksTree(levels: number, countPerLevel: number) {
      if (levels === 0) {
        resolvedActual++
        return 1
      }
      for (let i = 0; i < countPerLevel; i++) {
        if (levels % 2 === 0) {
          Promise.resolve().then(() => {
            createMicrotasksTree(levels - 1, countPerLevel)
          })
        } else {
          const delay = Math.floor(Math.random() * 100)
          maxTime = Math.max(maxTime, timeMock.time() + delay)
          timeMock.setTimeout(() => {
            createMicrotasksTree(levels - 1, countPerLevel)
          }, delay)
        }
      }
      return countPerLevel ** levels
    }

    for (let i = 0; i < 5; i++) {
      resolvedActual = 0
      const resolvedExpected = createMicrotasksTree(i, i)
      await waitTimeMock(timeMock)
      console.log('i', i)
      // expect(resolvedActual).toBe(resolvedExpected)
      // expect(timeMock.time()).toBe(maxTime)
      assert.strictEqual(resolvedActual, resolvedExpected)
      assert.strictEqual(timeMock.time(), maxTime)
    }
  })
})

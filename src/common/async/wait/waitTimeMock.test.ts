import { describe, it, assert } from 'vitest'
import { TimeMock } from 'src/common/time/time'
import { waitTimeMock } from './waitTimeMock'
import { EMPTY_FUNC } from 'src/common/constants'

describe('waitTimeMock', () => {
  it('base', async () => {
    const timeMock = new TimeMock()
    assert.strictEqual(timeMock.time(), 1)
    await waitTimeMock(timeMock)
    assert.strictEqual(timeMock.time(), 1)

    timeMock.setTimeout(EMPTY_FUNC, 123)
    await waitTimeMock(timeMock)
    assert.strictEqual(timeMock.time(), 124)

    timeMock.setTime(1000)
    timeMock.setTimeout(EMPTY_FUNC, 5)
    timeMock.setTimeout(EMPTY_FUNC, 17)
    timeMock.setTimeout(EMPTY_FUNC, 11)
    timeMock.setTimeout(EMPTY_FUNC, 16)
    await waitTimeMock(timeMock)
    assert.strictEqual(timeMock.time(), 1017)

    timeMock.setTime(2000)
    timeMock.setTimeout(EMPTY_FUNC, 5)
    timeMock.setTimeout(EMPTY_FUNC, 17)
    timeMock.setTimeout(EMPTY_FUNC, 11)
    timeMock.setTimeout(EMPTY_FUNC, 16)
    await Promise.all(Array.from({ length: 10 }, () => waitTimeMock(timeMock)))
    assert.strictEqual(timeMock.time(), 2017)
  })

  it('stress', async () => {
    const timeMock = new TimeMock()
    let resolvedActual = 0
    let timeMax = 1
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
          timeMax = Math.max(timeMax, timeMock.time() + delay)
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
      assert.strictEqual(resolvedActual, resolvedExpected)
      assert.strictEqual(timeMock.time(), timeMax)
    }
  })
})

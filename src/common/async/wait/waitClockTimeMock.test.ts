import { describe, it, assert } from 'vitest'
import { ClockTimeMock } from 'src/common/time/clock-time'
import { waitClockTimeMock } from './waitClockTimeMock'
import { EMPTY_FUNC } from 'src/common/constants'

describe('waitClockTimeMock', () => {
  it('base', async () => {
    const clockTimeMock = new ClockTimeMock()
    assert.strictEqual(clockTimeMock.value(), 1)
    await waitClockTimeMock(clockTimeMock)
    assert.strictEqual(clockTimeMock.value(), 1)

    clockTimeMock.setTimeout(EMPTY_FUNC, 123)
    await waitClockTimeMock(clockTimeMock)
    assert.strictEqual(clockTimeMock.value(), 124)

    clockTimeMock.setValue(1000)
    clockTimeMock.setTimeout(EMPTY_FUNC, 5)
    clockTimeMock.setTimeout(EMPTY_FUNC, 17)
    clockTimeMock.setTimeout(EMPTY_FUNC, 11)
    clockTimeMock.setTimeout(EMPTY_FUNC, 16)
    await waitClockTimeMock(clockTimeMock)
    assert.strictEqual(clockTimeMock.value(), 1017)

    clockTimeMock.setValue(2000)
    clockTimeMock.setTimeout(EMPTY_FUNC, 5)
    clockTimeMock.setTimeout(EMPTY_FUNC, 17)
    clockTimeMock.setTimeout(EMPTY_FUNC, 11)
    clockTimeMock.setTimeout(EMPTY_FUNC, 16)
    await Promise.all(
      Array.from({ length: 10 }, () => waitClockTimeMock(clockTimeMock)),
    )
    assert.strictEqual(clockTimeMock.value(), 2017)
  })

  it('stress', async () => {
    const clockTimeMock = new ClockTimeMock()
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
          timeMax = Math.max(timeMax, clockTimeMock.value() + delay)
          clockTimeMock.setTimeout(() => {
            createMicrotasksTree(levels - 1, countPerLevel)
          }, delay)
        }
      }
      return countPerLevel ** levels
    }

    for (let i = 0; i < 5; i++) {
      resolvedActual = 0
      const resolvedExpected = createMicrotasksTree(i, i)
      await waitClockTimeMock(clockTimeMock)
      assert.strictEqual(resolvedActual, resolvedExpected)
      assert.strictEqual(clockTimeMock.value(), timeMax)
    }
  })
})

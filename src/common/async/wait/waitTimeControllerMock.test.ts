import { describe, it, assert } from 'vitest'
import { TimeControllerMock } from '@flemist/time-controller'
import { waitTimeControllerMock } from './waitTimeControllerMock'
import { EMPTY_FUNC } from 'src/common/constants'

describe('waitTimeControllerMock', () => {
  it('base', async () => {
    const timeController = new TimeControllerMock()
    // expect(timeController.now()).toBe(1)
    assert.strictEqual(timeController.now(), 1)
    await waitTimeControllerMock(timeController)
    // expect(timeController.now()).toBe(1)
    assert.strictEqual(timeController.now(), 1)

    timeController.setTimeout(EMPTY_FUNC, 123)
    await waitTimeControllerMock(timeController)
    // expect(timeController.now()).toBe(124)
    assert.strictEqual(timeController.now(), 124)

    timeController.setTime(1000)
    timeController.setTimeout(EMPTY_FUNC, 5)
    timeController.setTimeout(EMPTY_FUNC, 17)
    timeController.setTimeout(EMPTY_FUNC, 11)
    timeController.setTimeout(EMPTY_FUNC, 16)
    await waitTimeControllerMock(timeController)
    // expect(timeController.now()).toBe(1017)
    assert.strictEqual(timeController.now(), 1017)

    timeController.setTime(2000)
    timeController.setTimeout(EMPTY_FUNC, 5)
    timeController.setTimeout(EMPTY_FUNC, 17)
    timeController.setTimeout(EMPTY_FUNC, 11)
    timeController.setTimeout(EMPTY_FUNC, 16)
    await Promise.all(
      Array.from({ length: 10 }, () => waitTimeControllerMock(timeController)),
    )
    // expect(timeController.now()).toBe(2017)
    assert.strictEqual(timeController.now(), 2017)
  })

  it('stress', async () => {
    const timeController = new TimeControllerMock()
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
          maxTime = Math.max(maxTime, timeController.now() + delay)
          timeController.setTimeout(() => {
            createMicrotasksTree(levels - 1, countPerLevel)
          }, delay)
        }
      }
      return countPerLevel ** levels
    }

    for (let i = 0; i < 5; i++) {
      resolvedActual = 0
      const resolvedExpected = createMicrotasksTree(i, i)
      await waitTimeControllerMock(timeController)
      console.log('i', i)
      // expect(resolvedActual).toBe(resolvedExpected)
      // expect(timeController.now()).toBe(maxTime)
      assert.strictEqual(resolvedActual, resolvedExpected)
      assert.strictEqual(timeController.now(), maxTime)
    }
  })
})

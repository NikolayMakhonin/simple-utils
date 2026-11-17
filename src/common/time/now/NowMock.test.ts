import { describe, it, expect } from 'vitest'
import { TimeControllerMock } from '../time-controller'
import { NowMock } from './NowMock'

describe('NowMock', () => {
  it('base', () => {
    // Without a time controller, now() changes only by setTime()
    const nowMock = new NowMock()
    expect(nowMock.now()).toBe(0)
    nowMock.setTime(1000)
    expect(nowMock.now()).toBe(1000)
    // Each value is greater than now() and than the previous value
    expect(nowMock.nowUnique()).toBe(1001)
    expect(nowMock.nowUnique()).toBe(1002)
    expect(nowMock.now()).toBe(1000)
  })

  it('timeController', () => {
    const timeController = new TimeControllerMock()
    const nowMock = new NowMock({ timeController })
    expect(nowMock.now()).toBe(0)
    // now() advances with the time controller
    timeController.addTime(100)
    expect(nowMock.now()).toBe(100)
    // setTime() sets now() at this moment, and now() keeps advancing
    nowMock.setTime(1000)
    expect(nowMock.now()).toBe(1000)
    timeController.addTime(50)
    expect(nowMock.now()).toBe(1050)
    expect(nowMock.nowUnique()).toBe(1051)
  })
})

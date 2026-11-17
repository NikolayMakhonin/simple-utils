import { describe, it, expect } from 'vitest'
import { TimeMock } from '../time'
import { DateMock } from './DateMock'

describe('DateMock', () => {
  it('base', () => {
    // Without the option time, now() changes only by setNow()
    const dateMock = new DateMock()
    expect(dateMock.now()).toBe(0)
    dateMock.setNow(1000)
    expect(dateMock.now()).toBe(1000)
    // Each value is greater than now() and than the previous value
    expect(dateMock.nowUnique()).toBe(1001)
    expect(dateMock.nowUnique()).toBe(1002)
    expect(dateMock.now()).toBe(1000)
  })

  it('time', () => {
    const timeMock = new TimeMock()
    const dateMock = new DateMock({ time: timeMock })
    expect(dateMock.now()).toBe(0)
    // now() advances with timeMock
    timeMock.addTime(100)
    expect(dateMock.now()).toBe(100)
    // setNow() sets now() at this moment, and now() keeps advancing
    dateMock.setNow(1000)
    expect(dateMock.now()).toBe(1000)
    timeMock.addTime(50)
    expect(dateMock.now()).toBe(1050)
    expect(dateMock.nowUnique()).toBe(1051)
  })
})

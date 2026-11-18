import { describe, it, expect } from 'vitest'
import { ClockTimeMock } from '../clock-time'
import { ClockDateMock } from './ClockDateMock'

describe('ClockDateMock', () => {
  it('base', () => {
    // Without the option clockTime, value() changes only by setValue()
    const clockDateMock = new ClockDateMock()
    expect(clockDateMock.value()).toBe(0)
    clockDateMock.setValue(1000)
    expect(clockDateMock.value()).toBe(1000)
    // Each value is greater than value() and than the previous value
    expect(clockDateMock.valueUnique()).toBe(1001)
    expect(clockDateMock.valueUnique()).toBe(1002)
    expect(clockDateMock.value()).toBe(1000)
  })

  it('time', () => {
    const clockTimeMock = new ClockTimeMock()
    const clockDateMock = new ClockDateMock({ clockTime: clockTimeMock })
    expect(clockDateMock.value()).toBe(0)
    // value() advances with clockTimeMock
    clockTimeMock.addValue(100)
    expect(clockDateMock.value()).toBe(100)
    // setValue() sets value() at this moment, and value() keeps advancing
    clockDateMock.setValue(1000)
    expect(clockDateMock.value()).toBe(1000)
    clockTimeMock.addValue(50)
    expect(clockDateMock.value()).toBe(1050)
    expect(clockDateMock.valueUnique()).toBe(1051)
  })
})

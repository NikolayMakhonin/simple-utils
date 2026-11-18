import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { ClockTimeMock } from '../clock-time'
import { DATE_JUMP_MINIMUM, ClockDateReal } from './ClockDateReal'

describe('ClockDateReal', () => {
  let dateDevice = 0
  let clockTimeMock: ClockTimeMock = null!

  beforeEach(() => {
    dateDevice = 1_700_000_000_000
    clockTimeMock = new ClockTimeMock()
    vi.spyOn(Date, 'now').mockImplementation(() => dateDevice)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // Real time passes: Date.now() and clockTimeMock both count it
  function wait(duration: number) {
    dateDevice += duration
    clockTimeMock.addValue(duration)
  }

  function test(
    clockDateReal: ClockDateReal,
    date: number,
    offset: number | null,
    dateMinimum: number | null,
  ) {
    expect(clockDateReal.value()).toBe(date)
    expect(clockDateReal.offset).toBe(offset)
    expect(clockDateReal.dateMinimum).toBe(dateMinimum)
  }

  it('base', () => {
    const clockDateReal = new ClockDateReal({ clockTime: clockTimeMock })
    // Before the first update, value() follows Date.now()
    test(clockDateReal, dateDevice, null, null)
    clockDateReal.updateOffset(500, null)
    test(clockDateReal, dateDevice + 500, 500, null)
    // The time advances with real time
    wait(1000)
    test(clockDateReal, dateDevice + 500, 500, null)
    // The time is never below dateMinimum
    clockDateReal.updateOffset(0, dateDevice + 2000)
    test(clockDateReal, dateDevice + 2000, 2000, dateDevice + 2000)
    // A range that holds the time keeps it
    clockDateReal.updateDate([dateDevice + 1000, dateDevice + 3000])
    test(clockDateReal, dateDevice + 2000, 2000, dateDevice + 1000)
    // A range that misses the time moves it to the middle of the range
    clockDateReal.updateDate([dateDevice + 5000, dateDevice + 6000])
    test(clockDateReal, dateDevice + 5500, 5500, dateDevice + 5000)
  })

  it('jumps of Date.now()', () => {
    const clockDateReal = new ClockDateReal({ clockTime: clockTimeMock })
    clockDateReal.updateOffset(0, dateDevice)
    const date = dateDevice
    // A jump up to DATE_JUMP_MINIMUM leaves the time
    dateDevice += DATE_JUMP_MINIMUM
    test(clockDateReal, date, date - dateDevice, date)
    // A larger forward jump, a sleep or a device clock set forward, moves the time forward
    dateDevice += DATE_JUMP_MINIMUM + 1
    test(
      clockDateReal,
      date + DATE_JUMP_MINIMUM + 1,
      date + DATE_JUMP_MINIMUM + 1 - dateDevice,
      date,
    )
    // A backward change of Date.now() leaves the time
    dateDevice -= 60 * 60 * 1000
    test(
      clockDateReal,
      date + DATE_JUMP_MINIMUM + 1,
      date + DATE_JUMP_MINIMUM + 1 - dateDevice,
      date,
    )
  })

  it('whole milliseconds', () => {
    const clockDateReal = new ClockDateReal({ clockTime: clockTimeMock })
    clockDateReal.updateOffset(0, dateDevice)
    const date = dateDevice
    clockTimeMock.addValue(1.75)
    dateDevice += 1
    test(clockDateReal, date + 1, 0, date + 1)
    // The middle of the range lies between two milliseconds
    clockDateReal.updateDate([dateDevice + 5000, dateDevice + 5001])
    test(clockDateReal, dateDevice + 5000, 5000, dateDevice + 5000)
  })

  it('nowUnique', () => {
    const clockDateReal = new ClockDateReal({ clockTime: clockTimeMock })
    clockDateReal.updateOffset(0, null)
    // Each value is greater than value() and than the previous value
    expect(clockDateReal.valueUnique()).toBe(dateDevice + 1)
    expect(clockDateReal.valueUnique()).toBe(dateDevice + 2)
    // The values of valueUnique() do not lift value()
    expect(clockDateReal.value()).toBe(dateDevice)
    // An update that moves value() back by up to 10 minutes keeps the values increasing
    clockDateReal.updateDate([
      dateDevice - 5 * 60 * 1000,
      dateDevice - 5 * 60 * 1000 + 1000,
    ])
    expect(clockDateReal.valueUnique()).toBe(dateDevice + 3)
    // After an update that moves value() further back, the values restart from value() with a warning
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    clockDateReal.updateDate([
      dateDevice - 60 * 60 * 1000,
      dateDevice - 60 * 60 * 1000 + 1000,
    ])
    expect(warn).toHaveBeenCalledOnce()
    expect(clockDateReal.valueUnique()).toBe(clockDateReal.value() + 1)
  })

  it('errors', () => {
    const clockDateReal = new ClockDateReal({ clockTime: clockTimeMock })
    expect(() => clockDateReal.updateOffset(NaN, null)).toThrow(
      /offset \(NaN\) should be a finite number/,
    )
    expect(() => clockDateReal.updateOffset(0, Infinity)).toThrow(
      /dateMinimum \(Infinity\) should be a finite number or null/,
    )
  })
})

import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { TimeMock } from '../time'
import { DATE_JUMP_MINIMUM, DateReal } from './DateReal'

describe('DateReal', () => {
  let dateDevice = 0
  let timeMock: TimeMock = null!

  beforeEach(() => {
    dateDevice = 1_700_000_000_000
    timeMock = new TimeMock()
    vi.spyOn(Date, 'now').mockImplementation(() => dateDevice)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // Real time passes: Date.now() and timeMock both count it
  function wait(duration: number) {
    dateDevice += duration
    timeMock.addTime(duration)
  }

  function test(
    dateReal: DateReal,
    now: number,
    offset: number | null,
    realDateMinimum: number | null,
  ) {
    expect(dateReal.now()).toBe(now)
    expect(dateReal.offset).toBe(offset)
    expect(dateReal.realDateMinimum).toBe(realDateMinimum)
  }

  it('base', () => {
    const dateReal = new DateReal({ time: timeMock })
    // Before the first update, now() follows Date.now()
    test(dateReal, dateDevice, null, null)
    dateReal.updateOffset(500, null)
    test(dateReal, dateDevice + 500, 500, null)
    // The time advances with real time
    wait(1000)
    test(dateReal, dateDevice + 500, 500, null)
    // The time is never below realDateMinimum
    dateReal.updateOffset(0, dateDevice + 2000)
    test(dateReal, dateDevice + 2000, 2000, dateDevice + 2000)
    // A range that holds the time keeps it
    dateReal.updateRealDate([dateDevice + 1000, dateDevice + 3000])
    test(dateReal, dateDevice + 2000, 2000, dateDevice + 1000)
    // A range that misses the time moves it to the middle of the range
    dateReal.updateRealDate([dateDevice + 5000, dateDevice + 6000])
    test(dateReal, dateDevice + 5500, 5500, dateDevice + 5000)
  })

  it('jumps of Date.now()', () => {
    const dateReal = new DateReal({ time: timeMock })
    dateReal.updateOffset(0, dateDevice)
    const now = dateDevice
    // A jump up to DATE_JUMP_MINIMUM leaves the time
    dateDevice += DATE_JUMP_MINIMUM
    test(dateReal, now, now - dateDevice, now)
    // A larger forward jump, a sleep or a device clock set forward, moves the time forward
    dateDevice += DATE_JUMP_MINIMUM + 1
    test(
      dateReal,
      now + DATE_JUMP_MINIMUM + 1,
      now + DATE_JUMP_MINIMUM + 1 - dateDevice,
      now,
    )
    // A backward change of Date.now() leaves the time
    dateDevice -= 60 * 60 * 1000
    test(
      dateReal,
      now + DATE_JUMP_MINIMUM + 1,
      now + DATE_JUMP_MINIMUM + 1 - dateDevice,
      now,
    )
  })

  it('whole milliseconds', () => {
    const dateReal = new DateReal({ time: timeMock })
    dateReal.updateOffset(0, dateDevice)
    const now = dateDevice
    timeMock.addTime(1.75)
    dateDevice += 1
    test(dateReal, now + 1, 0, now + 1)
    // The middle of the range lies between two milliseconds
    dateReal.updateRealDate([dateDevice + 5000, dateDevice + 5001])
    test(dateReal, dateDevice + 5000, 5000, dateDevice + 5000)
  })

  it('nowUnique', () => {
    const dateReal = new DateReal({ time: timeMock })
    dateReal.updateOffset(0, null)
    // Each value is greater than now() and than the previous value
    expect(dateReal.nowUnique()).toBe(dateDevice + 1)
    expect(dateReal.nowUnique()).toBe(dateDevice + 2)
    // The values of nowUnique() do not lift now()
    expect(dateReal.now()).toBe(dateDevice)
    // An update that moves now() back by up to 10 minutes keeps the values increasing
    dateReal.updateRealDate([
      dateDevice - 5 * 60 * 1000,
      dateDevice - 5 * 60 * 1000 + 1000,
    ])
    expect(dateReal.nowUnique()).toBe(dateDevice + 3)
    // After an update that moves now() further back, the values restart from now() with a warning
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    dateReal.updateRealDate([
      dateDevice - 60 * 60 * 1000,
      dateDevice - 60 * 60 * 1000 + 1000,
    ])
    expect(warn).toHaveBeenCalledOnce()
    expect(dateReal.nowUnique()).toBe(dateReal.now() + 1)
  })

  it('errors', () => {
    const dateReal = new DateReal({ time: timeMock })
    expect(() => dateReal.updateOffset(NaN, null)).toThrow(
      /offset \(NaN\) should be a finite number/,
    )
    expect(() => dateReal.updateOffset(0, Infinity)).toThrow(
      /realDateMinimum \(Infinity\) should be a finite number or null/,
    )
  })
})

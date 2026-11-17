import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { TimeControllerMock } from '../time-controller'
import { DATE_JUMP_MINIMUM, NowReal } from './NowReal'

describe('NowReal', () => {
  let date = 0
  let timeController: TimeControllerMock = null!

  beforeEach(() => {
    date = 1_700_000_000_000
    timeController = new TimeControllerMock()
    vi.spyOn(Date, 'now').mockImplementation(() => date)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // Real time passes: Date.now() and the time controller both count it
  function wait(time: number) {
    date += time
    timeController.addTime(time)
  }

  function test(
    nowReal: NowReal,
    now: number,
    offset: number | null,
    realDateMinimum: number | null,
  ) {
    expect(nowReal.now()).toBe(now)
    expect(nowReal.offset).toBe(offset)
    expect(nowReal.realDateMinimum).toBe(realDateMinimum)
  }

  it('base', () => {
    const nowReal = new NowReal({ timeController })
    // Before the first update, now() follows Date.now()
    test(nowReal, date, null, null)
    nowReal.updateOffset(500, null)
    test(nowReal, date + 500, 500, null)
    // The time advances with real time
    wait(1000)
    test(nowReal, date + 500, 500, null)
    // The time is never below realDateMinimum
    nowReal.updateOffset(0, date + 2000)
    test(nowReal, date + 2000, 2000, date + 2000)
    // A range that holds the time keeps it
    nowReal.updateRealDate([date + 1000, date + 3000])
    test(nowReal, date + 2000, 2000, date + 1000)
    // A range that misses the time moves it to the middle of the range
    nowReal.updateRealDate([date + 5000, date + 6000])
    test(nowReal, date + 5500, 5500, date + 5000)
  })

  it('jumps of Date.now()', () => {
    const nowReal = new NowReal({ timeController })
    nowReal.updateOffset(0, date)
    const time = date
    // A jump up to DATE_JUMP_MINIMUM leaves the time
    date += DATE_JUMP_MINIMUM
    test(nowReal, time, time - date, time)
    // A larger forward jump, a sleep or a device clock set forward, moves the time forward
    date += DATE_JUMP_MINIMUM + 1
    test(
      nowReal,
      time + DATE_JUMP_MINIMUM + 1,
      time + DATE_JUMP_MINIMUM + 1 - date,
      time,
    )
    // A backward change of Date.now() leaves the time
    date -= 60 * 60 * 1000
    test(
      nowReal,
      time + DATE_JUMP_MINIMUM + 1,
      time + DATE_JUMP_MINIMUM + 1 - date,
      time,
    )
  })

  it('whole milliseconds', () => {
    const nowReal = new NowReal({ timeController })
    nowReal.updateOffset(0, date)
    const time = date
    timeController.addTime(1.75)
    date += 1
    test(nowReal, time + 1, 0, time + 1)
    // The middle of the range lies between two milliseconds
    nowReal.updateRealDate([date + 5000, date + 5001])
    test(nowReal, date + 5000, 5000, date + 5000)
  })

  it('nowUnique', () => {
    const nowReal = new NowReal({ timeController })
    nowReal.updateOffset(0, null)
    // Each value is greater than now() and than the previous value
    expect(nowReal.nowUnique()).toBe(date + 1)
    expect(nowReal.nowUnique()).toBe(date + 2)
    // The values of nowUnique() do not lift now()
    expect(nowReal.now()).toBe(date)
    // An update that moves now() back by up to 10 minutes keeps the values increasing
    nowReal.updateRealDate([date - 5 * 60 * 1000, date - 5 * 60 * 1000 + 1000])
    expect(nowReal.nowUnique()).toBe(date + 3)
    // After an update that moves now() further back, the values restart from now() with a warning
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    nowReal.updateRealDate([
      date - 60 * 60 * 1000,
      date - 60 * 60 * 1000 + 1000,
    ])
    expect(warn).toHaveBeenCalledOnce()
    expect(nowReal.nowUnique()).toBe(nowReal.now() + 1)
  })

  it('errors', () => {
    const nowReal = new NowReal({ timeController })
    expect(() => nowReal.updateOffset(NaN, null)).toThrow(
      /offset \(NaN\) should be a finite number/,
    )
    expect(() => nowReal.updateOffset(0, Infinity)).toThrow(
      /realDateMinimum \(Infinity\) should be a finite number or null/,
    )
  })
})

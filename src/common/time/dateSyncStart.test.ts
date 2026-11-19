import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { dateSyncStart, type DateSyncStored } from './dateSyncStart'
import { DATE_JUMP_MINIMUM, ClockDateReal } from './clock-date'

describe('dateSyncStart', () => {
  // Real time, which exclusively the server reports
  let date = 0
  // How far the device clock is ahead of real time
  let dateOffset = 0
  // The elapsed time of the device, which stands still while the device sleeps
  let performanceNow = 0
  // How long each request takes
  let requestTime = 0
  let isOffline = false
  let fetchCount = 0

  beforeEach(() => {
    date = 1_700_000_000_000
    dateOffset = 0
    performanceNow = 1000
    requestTime = 0
    isOffline = false
    fetchCount = 0
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    })
    vi.spyOn(Date, 'now').mockImplementation(() => date + dateOffset)
    vi.spyOn(performance, 'now').mockImplementation(() => performanceNow)
    // The server stamps its Date header with whole seconds of real time
    vi.stubGlobal('fetch', async () => {
      fetchCount++
      if (isOffline) {
        throw new TypeError('Failed to fetch')
      }
      const dateStr = new Date(date).toUTCString()
      date += requestTime
      performanceNow += requestTime
      return new Response(null, { headers: { date: dateStr } })
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  // Real time passes while the device is awake
  async function wait(time: number) {
    date += time
    performanceNow += time
    await vi.advanceTimersByTimeAsync(time)
  }

  // Real time passes while no measurement starts.
  // Unlike in wait(), the timers run without a yield to promises after each of them.
  // An hour of the once-a-second check would take thousands of yields
  function waitSynchronously(time: number) {
    date += time
    performanceNow += time
    vi.advanceTimersByTime(time)
  }

  // Starts the sync of a new ClockDateReal and collects what it gives to save and onMeasure
  function start() {
    const clockDateReal = new ClockDateReal()
    const savedList: DateSyncStored[] = []
    const measureErrorList: unknown[] = []
    const stop = dateSyncStart({
      rangeWidthMaximum: 2500,
      save: o => {
        savedList.push(o)
      },
      onMeasure: error => {
        measureErrorList.push(error)
      },
      // The tests check every error through onMeasure
      logFuncError: () => false,
      clockDateReal,
    })
    return { clockDateReal, savedList, measureErrorList, stop }
  }

  it('base', async () => {
    // A right device clock: the measurement keeps clockDateReal.value()
    let sync = start()
    // The sync calls onMeasure exclusively after measurements, never at start
    expect(sync.measureErrorList).toEqual([])
    await wait(0)
    expect(fetchCount).toBe(1)
    expect(sync.clockDateReal.offset).toBe(0)
    expect(sync.savedList).toEqual([{ offset: 0, dateMinimum: date }])
    expect(sync.measureErrorList).toEqual([null])
    sync.stop()

    // A device clock ahead or behind: clockDateReal.value() moves to the middle of the range of real time
    dateOffset = 60 * 60 * 1000
    sync = start()
    await wait(0)
    expect(sync.clockDateReal.value()).toBe(date + 500)
    sync.stop()
    dateOffset = -60 * 60 * 1000
    sync = start()
    await wait(0)
    expect(sync.clockDateReal.value()).toBe(date + 500)
    sync.stop()
  })

  it('repeated measurements', async () => {
    // A failed measurement repeats after waits doubling from 1 second up to 10 seconds
    isOffline = true
    const sync = start()
    await wait(0)
    expect(fetchCount).toBe(1)
    expect(sync.measureErrorList[0]).toBeInstanceOf(TypeError)
    await wait(999)
    expect(fetchCount).toBe(1)
    await wait(1)
    expect(fetchCount).toBe(2)
    await wait(2000)
    expect(fetchCount).toBe(3)
    await wait(4000)
    expect(fetchCount).toBe(4)
    await wait(8000)
    expect(fetchCount).toBe(5)
    await wait(10_000)
    expect(fetchCount).toBe(6)
    await wait(10_000)
    expect(fetchCount).toBe(7)

    // After a success, the next measurement comes after an hour
    isOffline = false
    await wait(10_000)
    expect(fetchCount).toBe(8)
    expect(sync.measureErrorList.length).toBe(8)
    expect(sync.measureErrorList[7]).toBe(null)
    waitSynchronously(60 * 60 * 1000 - 1)
    expect(fetchCount).toBe(8)
    await wait(1)
    expect(fetchCount).toBe(9)
    sync.stop()

    // A range wider than rangeWidthMaximum updates clockDateReal and repeats after the same waits,
    // also while clockDateReal.value() stands above dateMinimum by more than rangeWidthMaximum
    requestTime = 2000
    date += 900
    const syncSlow = start()
    await wait(0)
    expect(fetchCount).toBe(10)
    expect(syncSlow.clockDateReal.value() - date).toBe(0)
    expect(
      syncSlow.clockDateReal.value() - syncSlow.clockDateReal.dateMinimum!,
    ).toBe(2900)
    // onMeasure gets the error of an answer whose range is too wide, after the answer has corrected the clock
    expect(syncSlow.measureErrorList[0]).toBeInstanceOf(Error)
    expect(String(syncSlow.measureErrorList[0])).toMatch(
      /wider than rangeWidthMaximum/,
    )
    await wait(999)
    expect(fetchCount).toBe(10)
    await wait(1)
    expect(fetchCount).toBe(11)
    await wait(1999)
    expect(fetchCount).toBe(11)
    await wait(1)
    expect(fetchCount).toBe(12)
    syncSlow.stop()
  })

  it('jumps of Date.now()', async () => {
    const sync = start()
    await wait(0)
    expect(fetchCount).toBe(1)

    // A jump of Date.now() up to DATE_JUMP_MINIMUM leaves clockDateReal.value(), so no measurement starts
    dateOffset += DATE_JUMP_MINIMUM
    await wait(1000)
    expect(fetchCount).toBe(1)

    // A device clock set forward moves clockDateReal.value() forward, and within a second a measurement takes it back
    dateOffset += 60 * 60 * 1000
    await wait(1000)
    expect(fetchCount).toBe(2)
    expect(sync.clockDateReal.value()).toBe(date + 500)

    // A sleep stops performance.now().
    // After the wake clockDateReal.value() adds the sleep, and a measurement checks clockDateReal.value()
    date += 10 * 60 * 1000
    await wait(1000)
    expect(fetchCount).toBe(3)

    // A call of updateOffset() with offset 0 moves clockDateReal.value() to the device clock, which is still ahead,
    // and within a second a measurement takes clockDateReal.value() back
    sync.clockDateReal.updateOffset(0, sync.clockDateReal.dateMinimum)
    await wait(1000)
    expect(fetchCount).toBe(4)
    expect(sync.clockDateReal.value()).toBe(date + 500)

    // While measurements fail after a jump, they repeat after the growing delays of the task, not every second
    isOffline = true
    dateOffset += 60 * 60 * 1000
    await wait(1000)
    expect(fetchCount).toBe(5)
    await wait(1000)
    expect(fetchCount).toBe(6)
    await wait(1000)
    expect(fetchCount).toBe(6)
    await wait(1000)
    expect(fetchCount).toBe(7)
    sync.stop()
  })

  it('save and stop', async () => {
    const sync = start()
    await wait(0)
    expect(sync.savedList.length).toBe(1)
    // The state is also saved every minute
    await wait(60 * 1000)
    expect(sync.savedList.length).toBe(2)

    // After stop, no timer is left, and nothing measures or saves
    sync.stop()
    expect(vi.getTimerCount()).toBe(0)
    await wait(60 * 60 * 1000)
    expect(fetchCount).toBe(1)
    expect(sync.savedList.length).toBe(2)
  })
})

import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { getDateInetRange } from './getDateInetRange'
import { DATE_JUMP_MINIMUM } from './now'

const DATE_HEADER = 'Wed, 01 Jan 2020 00:00:00 GMT'
const DATE_TIME = Date.UTC(2020, 0, 1)

describe('getDateInetRange', () => {
  let date = 0
  let performanceNow = 0

  beforeEach(() => {
    date = 1_700_000_000_000
    performanceNow = 1000
    vi.spyOn(Date, 'now').mockImplementation(() => date)
    vi.spyOn(performance, 'now').mockImplementation(() => performanceNow)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  // The response comes after requestTime of real time,
  // while Date.now() also jumps forward by dateJump
  function stubFetch(requestTime: number, dateJump: number) {
    vi.stubGlobal('fetch', async () => {
      date += requestTime + dateJump
      performanceNow += requestTime
      return new Response(null, { headers: { date: DATE_HEADER } })
    })
  }

  it('base', async () => {
    stubFetch(0, 0)
    expect(await getDateInetRange({ url: 'https://example.test/' })).toEqual([
      DATE_TIME,
      DATE_TIME + 1000,
    ])
    stubFetch(300, 0)
    expect(await getDateInetRange({ url: 'https://example.test/' })).toEqual([
      DATE_TIME,
      DATE_TIME + 1300,
    ])
  })

  it('jumps of Date.now()', async () => {
    // The range follows the request time, whatever Date.now() does
    stubFetch(300, DATE_JUMP_MINIMUM)
    expect(await getDateInetRange({ url: 'https://example.test/' })).toEqual([
      DATE_TIME,
      DATE_TIME + 1300,
    ])
    stubFetch(300, -60 * 60 * 1000)
    expect(await getDateInetRange({ url: 'https://example.test/' })).toEqual([
      DATE_TIME,
      DATE_TIME + 1300,
    ])
    // With dontThrow, a larger jump widens the range by the jump instead of throwing
    stubFetch(300, DATE_JUMP_MINIMUM + 1)
    expect(
      await getDateInetRange({ url: 'https://example.test/', dontThrow: true }),
    ).toEqual([DATE_TIME, DATE_TIME + 1300 + DATE_JUMP_MINIMUM + 1])
  })

  it('errors', async () => {
    stubFetch(300, DATE_JUMP_MINIMUM + 1)
    await expect(
      getDateInetRange({ url: 'https://example.test/' }),
    ).rejects.toThrow(
      /Date\.now\(\) got ahead of performance\.now\(\) by 1001 ms/,
    )
  })
})

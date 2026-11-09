import { describe, expect, it } from 'vitest'
import { formatDate } from './formatDate'

describe('formatDate', () => {
  function test(date: Date, timeZone: string | null, expected: string) {
    expect(formatDate(date, timeZone)).toBe(expected)
  }

  it('base', () => {
    test(new Date('2020-01-02T03:04:05.678Z'), 'UTC', '2020-01-02 03:04:05')
    test(new Date('0001-01-01T00:00:00Z'), 'UTC', '0001-01-01 00:00:00')
    test(new Date(8.64e15), 'UTC', '275760-09-13 00:00:00')
  })

  it('time zone', () => {
    test(new Date('2020-01-02T03:04:05Z'), 'Asia/Tokyo', '2020-01-02 12:04:05')
    test(new Date('2020-01-02T20:00:00Z'), 'Asia/Tokyo', '2020-01-03 05:00:00')
    const date = new Date(2020, 0, 2, 3, 4, 5)
    test(date, null, '2020-01-02 03:04:05')
  })

  it('separators', () => {
    const date = new Date('2020-01-02T03:04:05Z')
    expect(formatDate(date, 'UTC', 'T')).toBe('2020-01-02T03:04:05')
    expect(formatDate(date, 'UTC', '_', '-')).toBe('2020-01-02_03-04-05')
  })

  it('invalid date', () => {
    test(new Date(NaN), 'UTC', 'Invalid Date')
    test(new Date(NaN), null, 'Invalid Date')
    test(new Date(NaN), 'Asia/Tokyo', 'Invalid Date')
  })

  it('Invalid Date when timeZone moves the date out of the range of Date', () => {
    test(new Date(8.64e15), 'Asia/Tokyo', 'Invalid Date')
  })

  it('negative year throws', () => {
    expect(() =>
      formatDate(new Date('-000001-06-15T00:00:00Z'), 'UTC'),
    ).toThrow(/-1/)
    // In New York, 0000-01-01 00:00 UTC is still in year -1
    const date = new Date('0000-01-01T00:00:00Z')
    expect(formatDate(date, 'UTC')).toBe('0000-01-01 00:00:00')
    expect(() => formatDate(date, 'America/New_York')).toThrow(/-1/)
  })
})

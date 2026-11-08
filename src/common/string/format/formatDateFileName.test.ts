import { describe, it, expect } from 'vitest'
import { formatDateFileName } from './formatDateFileName'

describe('formatDateFileName', () => {
  function test(date: Date, timeZone: string | null, expected: string) {
    expect(formatDateFileName(date, timeZone)).toBe(expected)
  }

  it('base', () => {
    test(new Date('2020-01-02T03:04:05.000Z'), 'UTC', '2020-01-02_03-04-05')
    test(
      new Date('2020-01-01T00:00:00.000Z'),
      'America/New_York',
      '2019-12-31_19-00-00',
    )
  })

  it('invalid date', () => {
    test(new Date(NaN), 'UTC', 'Invalid Date')
  })

  it('negative year', () => {
    test(new Date('0000-06-15T00:00:00.000Z'), 'UTC', '0000-06-15_00-00-00')
    expect(() =>
      formatDateFileName(new Date('-000001-06-15T00:00:00.000Z'), 'UTC'),
    ).toThrow(/Negative year \(-1\)/)
    // The year becomes negative in the requested time zone
    expect(() =>
      formatDateFileName(
        new Date('0000-01-01T00:00:00.000Z'),
        'America/New_York',
      ),
    ).toThrow(/Negative year \(-1\)/)
  })
})

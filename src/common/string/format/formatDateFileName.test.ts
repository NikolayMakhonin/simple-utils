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
})

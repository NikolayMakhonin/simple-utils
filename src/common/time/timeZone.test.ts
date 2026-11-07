import { describe, it, assert } from 'vitest'
import { convertTimeZone } from './timeZone'
import { formatDate } from 'src/common/string/format/formatDate'

describe('date', () => {
  it('convertTimeZone', () => {
    // UTC, UTC
    assert.deepStrictEqual(
      convertTimeZone(new Date('2020-01-01T00:00:00.000Z'), 'UTC', 'UTC'),
      new Date('2020-01-01T00:00:00.000Z'),
    )

    // UTC, Europe/Kiev
    assert.deepStrictEqual(
      convertTimeZone(
        new Date('2020-01-01T00:00:00.000Z'),
        'UTC',
        'Europe/Kiev',
      ),
      new Date('2020-01-01T02:00:00.000Z'),
    )

    // Europe/Kiev, UTC
    assert.deepStrictEqual(
      convertTimeZone(
        new Date('2020-01-01T00:00:00.000Z'),
        'Europe/Kiev',
        'UTC',
      ),
      new Date('2019-12-31T22:00:00.000Z'),
    )

    // Europe/Kiev, America/Los_Angeles
    assert.deepStrictEqual(
      convertTimeZone(
        new Date('2020-01-01T00:00:00.000Z'),
        'Europe/Kiev',
        'America/Los_Angeles',
      ),
      new Date('2019-12-31T14:00:00.000Z'),
    )

    // America/Los_Angeles, Europe/Kiev
    assert.deepStrictEqual(
      convertTimeZone(
        new Date('2020-01-01T00:00:00.000Z'),
        'America/Los_Angeles',
        'Europe/Kiev',
      ),
      new Date('2020-01-01T10:00:00.000Z'),
    )

    // Local, Local
    assert.deepStrictEqual(
      convertTimeZone(new Date('2020-01-01T00:00:00.000Z')),
      new Date('2020-01-01T00:00:00.000Z'),
    )

    // forward and backward for timeZone list
    const timeZones = [
      null, // Local
      'UTC',
      'Europe/Kiev',
      'America/Los_Angeles',
      'America/New_York',
      'America/Chicago',
      'America/Denver',
      'Europe/London',
      'Europe/Paris',
      'Europe/Moscow',
      'Europe/Berlin',
      'Asia/Tokyo',
      'Asia/Shanghai',
      'Asia/Hong_Kong',
      'Asia/Kolkata',
      'Australia/Sydney',
      'Australia/Melbourne',
      'Australia/Perth',
      'Australia/Brisbane',
    ]
    for (const timeZoneFrom of timeZones) {
      for (const timeZoneTo of timeZones) {
        const date = new Date('2020-01-01T00:00:00.000Z')
        const result = convertTimeZone(date, timeZoneFrom, timeZoneTo)
        const resultBack = convertTimeZone(result, timeZoneTo, timeZoneFrom)
        assert.deepStrictEqual(resultBack, date)
      }
    }
  })

  it('convertTimeZone milliseconds', () => {
    const date = new Date('2020-01-01T00:00:00.600Z')
    const timeZones = [null, 'UTC', 'Europe/Kiev', 'Asia/Kolkata']
    for (const timeZoneFrom of timeZones) {
      for (const timeZoneTo of timeZones) {
        assert.strictEqual(
          convertTimeZone(date, timeZoneFrom, timeZoneTo).getUTCMilliseconds(),
          600,
        )
      }
    }
  })

  it('convertTimeZone DST', () => {
    // The wall-clock time 02:30 does not exist in America/New_York on 2024-03-10
    assert.deepStrictEqual(
      convertTimeZone(
        new Date('2024-03-10T02:30:00.000Z'),
        'UTC',
        'Europe/Kiev',
      ),
      new Date('2024-03-10T04:30:00.000Z'),
    )
    assert.deepStrictEqual(
      convertTimeZone(
        new Date('2024-03-10T06:30:00.000Z'),
        'UTC',
        'America/New_York',
      ),
      new Date('2024-03-10T01:30:00.000Z'),
    )
    assert.deepStrictEqual(
      convertTimeZone(
        new Date('2024-03-10T07:30:00.000Z'),
        'UTC',
        'America/New_York',
      ),
      new Date('2024-03-10T03:30:00.000Z'),
    )
  })

  it('convertTimeZone invalid date', () => {
    assert.ok(
      Number.isNaN(
        convertTimeZone(new Date(NaN), 'UTC', 'Europe/Kiev').getTime(),
      ),
    )
    assert.ok(Number.isNaN(convertTimeZone(new Date(NaN)).getTime()))
  })

  it('formatDate', () => {
    assert.strictEqual(
      formatDate(new Date('2020-01-01T00:00:00.000Z'), 'UTC'),
      '2020-01-01 00:00:00',
    )

    assert.strictEqual(
      formatDate(new Date('2020-01-01T00:00:00.000Z'), 'Europe/Kiev'),
      '2020-01-01 02:00:00',
    )

    assert.strictEqual(
      formatDate(new Date('2020-01-01T00:00:00.000Z'), 'America/Los_Angeles'),
      '2019-12-31 16:00:00',
    )

    assert.strictEqual(
      formatDate(new Date('2020-01-01T00:00:00.000Z'), 'America/New_York'),
      '2019-12-31 19:00:00',
    )
  })

  it('convertTimeZone local', () => {
    const date = new Date('2020-01-01T00:00:00.000Z')
    const time = date.getTime()
    const localOffset = -date.getTimezoneOffset() * 60 * 1000
    const losAngelesOffset = -8 * 60 * 60 * 1000

    // Local, UTC
    assert.deepStrictEqual(
      convertTimeZone(date, null, 'UTC'),
      new Date(time - localOffset),
    )

    // UTC, Local
    assert.deepStrictEqual(
      convertTimeZone(date, 'UTC', null),
      new Date(time + localOffset),
    )

    // Local, America/Los_Angeles
    assert.deepStrictEqual(
      convertTimeZone(date, null, 'America/Los_Angeles'),
      new Date(time - localOffset + losAngelesOffset),
    )

    // America/Los_Angeles, Local
    assert.deepStrictEqual(
      convertTimeZone(date, 'America/Los_Angeles', null),
      new Date(time + localOffset - losAngelesOffset),
    )
  })
})

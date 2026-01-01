import { describe, it, assert } from 'vitest'
import { convertTimeZone } from './timeZone'
import { dateToString } from 'src/common/time/dateToString'

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

  it('dateToString', () => {
    assert.strictEqual(
      dateToString(new Date('2020-01-01T00:00:00.000Z'), 'UTC'),
      '2020-01-01 00:00:00',
    )

    assert.strictEqual(
      dateToString(new Date('2020-01-01T00:00:00.000Z'), 'Europe/Kiev'),
      '2020-01-01 02:00:00',
    )

    assert.strictEqual(
      dateToString(new Date('2020-01-01T00:00:00.000Z'), 'America/Los_Angeles'),
      '2019-12-31 16:00:00',
    )

    assert.strictEqual(
      dateToString(new Date('2020-01-01T00:00:00.000Z'), 'America/Los_Angeles'),
      '2019-12-31 16:00:00',
    )

    assert.strictEqual(
      dateToString(new Date('2020-01-01T00:00:00.000Z'), 'America/New_York'),
      '2019-12-31 19:00:00',
    )
  })

  it.skip('convertTimeZone local', () => {
    // Local (+04:00), UTC
    assert.deepStrictEqual(
      convertTimeZone(new Date('2020-01-01T00:00:00.000Z'), null, 'UTC'),
      new Date('2019-12-31T20:00:00.000Z'),
    )

    // UTC, Local (+04:00)
    assert.deepStrictEqual(
      convertTimeZone(new Date('2020-01-01T00:00:00.000Z'), 'UTC', null),
      new Date('2020-01-01T04:00:00.000Z'),
    )

    // Local (+04:00), America/Los_Angeles
    assert.deepStrictEqual(
      convertTimeZone(
        new Date('2020-01-01T00:00:00.000Z'),
        null,
        'America/Los_Angeles',
      ),
      new Date('2019-12-31T12:00:00.000Z'),
    )

    // America/Los_Angeles, Local (+04:00)
    assert.deepStrictEqual(
      convertTimeZone(
        new Date('2020-01-01T00:00:00.000Z'),
        'America/Los_Angeles',
        null,
      ),
      new Date('2020-01-01T12:00:00.000Z'),
    )
  })

  it('dateToString current', () => {
    console.log(
      `[test][timeZone] Current date UTC: ${dateToString(new Date(), 'UTC')}`,
    )
    console.log(
      `[test][timeZone] Current date Europe/Kiev: ${dateToString(new Date(), 'Europe/Kiev')}`,
    )
    console.log(
      `[test][timeZone] Current date America/Los_Angeles: ${dateToString(
        new Date(),
        'America/Los_Angeles',
      )}`,
    )
    console.log(
      `[test][timeZone] Current date Asia/Tbilisi: ${dateToString(new Date(), 'Asia/Tbilisi')}`,
    )
  })

  it('parse', () => {
    const date = new Date('2020-01-01')
    date.setMonth(date.getMonth() + 1)
    date.setMilliseconds(-1)
    console.log('[test][timeZone] date.toISOString', date.toISOString())
    console.log('[test][timeZone] date.toString', date.toString())
  })
})

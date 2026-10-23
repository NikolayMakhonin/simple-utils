/** Default time zone is Local */
export function convertTimeZone(
  date: Date,
  timeZoneFrom?: null | string,
  timeZoneTo?: null | string,
): Date {
  const time = date.getTime()
  // An invalid date converts to an invalid date,
  // because Intl.DateTimeFormat throws for it
  if (Number.isNaN(time)) {
    return new Date(NaN)
  }
  return new Date(
    time +
      getTimeZoneOffset(date, timeZoneTo) -
      getTimeZoneOffset(date, timeZoneFrom),
  )
}

/**
 * Milliseconds to add to UTC time to get the wall-clock time of the time zone at the date
 * Default time zone is Local
 */
function getTimeZoneOffset(
  date: Date,
  timeZone: null | undefined | string,
): number {
  let day = 0
  let hours = 0
  let minutes = 0
  let seconds = 0
  if (timeZone == null) {
    day = date.getDate()
    hours = date.getHours()
    minutes = date.getMinutes()
    seconds = date.getSeconds()
  } else {
    const parts = getDateTimeFormat(timeZone).formatToParts(date)
    for (let i = 0, len = parts.length; i < len; i++) {
      const part = parts[i]
      switch (part.type) {
        case 'day':
          day = +part.value
          break
        case 'hour':
          hours = +part.value
          break
        case 'minute':
          minutes = +part.value
          break
        case 'second':
          seconds = +part.value
          break
      }
    }
  }
  let offset =
    (hours - date.getUTCHours()) * 3600 +
    (minutes - date.getUTCMinutes()) * 60 +
    seconds -
    date.getUTCSeconds()
  // The offset is below one day, so a different day of month means the next or the previous day
  if (day !== date.getUTCDate()) {
    offset += offset < 0 ? 86400 : -86400
  }
  return offset * 1000
}

// Creating Intl.DateTimeFormat is expensive, so one instance per time zone is reused
let dateTimeFormats: Map<string, Intl.DateTimeFormat> | null = null

function getDateTimeFormat(timeZone: string): Intl.DateTimeFormat {
  if (dateTimeFormats == null) {
    dateTimeFormats = new Map()
  }
  let dateTimeFormat = dateTimeFormats.get(timeZone)
  if (dateTimeFormat == null) {
    dateTimeFormat = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    })
    dateTimeFormats.set(timeZone, dateTimeFormat)
  }
  return dateTimeFormat
}

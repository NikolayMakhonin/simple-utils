import { convertTimeZone } from 'src/common/time/timeZone'

/**
 * YYYY-MM-DD{dateTimeSeparator}HH{timeSeparator}mm{timeSeparator}ss, or Invalid Date
 * Default timeZone is Local, dateTimeSeparator is a space, timeSeparator is a colon
 * Throws for a negative year
 */
export function formatDate(
  date: Date,
  timeZone?: null | string,
  dateTimeSeparator?: null | string,
  timeSeparator?: null | string,
): string {
  date = convertTimeZone(date, 'UTC', timeZone)
  // After the conversion: a valid date converts to an invalid one
  // when its time in the time zone is outside of the range of Date
  if (Number.isNaN(date.getTime())) {
    return 'Invalid Date'
  }

  const yearNumber = date.getUTCFullYear()
  if (yearNumber < 0) {
    throw new Error(
      `[formatDate] Negative year (${yearNumber}) is not supported`,
    )
  }

  const year = yearNumber.toString().padStart(4, '0')
  const month = (date.getUTCMonth() + 1).toString().padStart(2, '0')
  const day = date.getUTCDate().toString().padStart(2, '0')
  const hours = date.getUTCHours().toString().padStart(2, '0')
  const minutes = date.getUTCMinutes().toString().padStart(2, '0')
  const seconds = date.getUTCSeconds().toString().padStart(2, '0')

  const separator = timeSeparator ?? ':'
  return `${year}-${month}-${day}${dateTimeSeparator ?? ' '}${hours}${separator}${minutes}${separator}${seconds}`
}

import { convertTimeZone } from 'src/common/time/timeZone'

/**
 * Formats the date in timeZone as `YYYY-MM-DD HH:mm:ss`.
 * The dateTimeSeparator replaces the space, and timeSeparator replaces the colons.
 * The default timeZone is Local.
 * Returns 'Invalid Date' for an invalid date, also when timeZone moves it out of the range of Date.
 * Throws for a negative year
 */
export function formatDate(
  date: Date,
  timeZone?: null | string,
  dateTimeSeparator?: null | string,
  timeSeparator?: null | string,
): string {
  date = convertTimeZone(date, 'UTC', timeZone)
  // Checked after convertTimeZone, because it also gives an invalid date
  // when the time in timeZone is out of the range of Date
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

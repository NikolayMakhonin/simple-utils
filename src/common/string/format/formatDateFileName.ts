import { convertTimeZone } from 'src/common/time/timeZone'

/**
 * Default timeZone is Local
 */
export function formatDateFileName(
  date: Date,
  timeZone?: string | null,
): string {
  date = convertTimeZone(date, 'UTC', timeZone)

  const year = date.getUTCFullYear().toString().padStart(4, '0')
  const month = (date.getUTCMonth() + 1).toString().padStart(2, '0')
  const day = date.getUTCDate().toString().padStart(2, '0')
  const hours = date.getUTCHours().toString().padStart(2, '0')
  const minutes = date.getUTCMinutes().toString().padStart(2, '0')
  const seconds = date.getUTCSeconds().toString().padStart(2, '0')

  return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`
}

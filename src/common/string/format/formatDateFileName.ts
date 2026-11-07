import { formatDate } from './formatDate'

/**
 * Default timeZone is Local
 */
export function formatDateFileName(
  date: Date,
  timeZone?: null | string,
): string {
  return formatDate(date, timeZone, '_', '-')
}

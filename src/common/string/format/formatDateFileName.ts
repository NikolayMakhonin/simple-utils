import { formatDate } from './formatDate'

/**
 * Formats the date in timeZone as `YYYY-MM-DD_HH-mm-ss`. The default timeZone is Local.
 * Returns 'Invalid Date' for an invalid date. Throws for a negative year
 */
export function formatDateFileName(
  date: Date,
  timeZone?: null | string,
): string {
  return formatDate(date, timeZone, '_', '-')
}

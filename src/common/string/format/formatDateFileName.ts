import { formatDate } from './formatDate'

/**
 * YYYY-MM-DD_HH-mm-ss, or Invalid Date
 * Default timeZone is Local
 * Throws for a negative year
 */
export function formatDateFileName(
  date: Date,
  timeZone?: null | string,
): string {
  return formatDate(date, timeZone, '_', '-')
}

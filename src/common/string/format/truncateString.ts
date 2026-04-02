export function truncateString(
  str: string,
  maxLength: number | null | undefined,
): string
export function truncateString(
  str: string | null | undefined,
  maxLength: number | null | undefined,
): string | null
export function truncateString(
  str: string | null | undefined,
  maxLength: number | null | undefined,
): string | null {
  if (str == null) {
    return str ?? null
  }
  if (maxLength == null) {
    return str
  }
  if (str.length > maxLength) {
    if (maxLength <= 0) {
      return '…'
    }
    return str.slice(0, maxLength - 1) + '…'
  }
  return str
}

export type TruncateStringOptions = {
  fromStart?: boolean
}

export function truncateString(
  str: string,
  maxLength: number | null | undefined,
  options?: null | TruncateStringOptions,
): string
export function truncateString(
  str: string | null | undefined,
  maxLength: number | null | undefined,
  options?: null | TruncateStringOptions,
): string | null
export function truncateString(
  str: string | null | undefined,
  maxLength: number | null | undefined,
  options?: null | TruncateStringOptions,
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
    if (options?.fromStart) {
      return '…' + str.slice(str.length - maxLength + 1)
    }
    return str.slice(0, maxLength - 1) + '…'
  }
  return str
}

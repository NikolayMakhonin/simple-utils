export type TruncateStringOptions = {
  fromStart?: null | boolean
  appendEllipsis?: null | boolean
  appendTruncatedLength?: null | boolean
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
    return null
  }
  if (maxLength == null || str.length <= maxLength) {
    return str
  }

  const ellipsis = options?.appendEllipsis ? '…' : ''
  const overhead =
    ellipsis.length +
    (options?.appendTruncatedLength ? String(str.length).length + 2 : 0)
  const newLength = Math.max(0, maxLength - overhead)
  const tag = options?.appendTruncatedLength
    ? `(${str.length - newLength})`
    : ''

  if (newLength <= 0) {
    return tag + ellipsis
  }
  if (options?.fromStart) {
    return tag + ellipsis + str.slice(str.length - newLength)
  }
  return str.slice(0, newLength) + ellipsis + tag
}

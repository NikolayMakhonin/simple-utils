export type TruncateStringOptions = {
  /** Remove the start of the string instead of its end */
  fromStart?: null | boolean
  appendEllipsis?: null | boolean
  /**
   * Add the number of removed code units (as counted by str.length) as `(5)`,
   * at the side where they were removed
   */
  appendTruncatedLength?: null | boolean
}

/**
 * Cuts str to at most maxLength code units. The ellipsis and the truncated length
 * are omitted when they do not fit. A surrogate pair is never cut in half
 */
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

  const fromStart = options?.fromStart
  const ellipsis = options?.appendEllipsis ? '…' : ''
  const tagLength = options?.appendTruncatedLength
    ? String(str.length).length + 2
    : 0
  const contentLength = maxLength - ellipsis.length - tagLength
  if (contentLength < 0) {
    return sliceSurrogateSafe(str, Math.max(0, maxLength), fromStart)
  }

  const content = sliceSurrogateSafe(str, contentLength, fromStart)
  const tag = tagLength > 0 ? `(${str.length - content.length})` : ''
  return fromStart ? tag + ellipsis + content : content + ellipsis + tag
}

/**
 * The first length code units of str, or the last ones when fromStart is set.
 * A surrogate pair cut by the boundary is dropped entirely, because half of it is a broken char
 */
function sliceSurrogateSafe(
  str: string,
  length: number,
  fromStart: null | undefined | boolean,
): string {
  if (fromStart) {
    const start = str.length - length
    const isLowSurrogate = (str.charCodeAt(start) & 0xfc00) === 0xdc00
    return str.slice(isLowSurrogate ? start + 1 : start)
  }
  const isHighSurrogate = (str.charCodeAt(length - 1) & 0xfc00) === 0xd800
  return str.slice(0, isHighSurrogate ? length - 1 : length)
}

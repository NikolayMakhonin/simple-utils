export type TruncateStringOptions = {
  /** Remove the start of the string instead of its end */
  fromStart?: null | boolean
  appendEllipsis?: null | boolean
  /** Add the number of removed code units in the form (5), on the side of the removed part */
  appendTruncatedLength?: null | boolean
}

/**
 * The result is never longer than maxLength: the ellipsis and the truncated length
 * are omitted when they do not fit, and a surrogate pair is never cut in half
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
 * At most length code units from the start of the string, or from its end when fromStart is set
 * Half of a surrogate pair would turn into a broken character, so a cut pair is dropped entirely
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

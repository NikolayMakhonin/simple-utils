export const EMPTY_FUNC = () => {}
export const EMPTY_ARRAY: readonly any[] = Object.freeze([])
export const EMPTY_SET: ReadonlySet<any> = new Set()
export const EMPTY_MAP: ReadonlyMap<any, any> = new Map()

export function isNullish<T>(
  value: T | null | undefined,
): value is null | undefined {
  return value == null
}

export function isNotNullish<T>(value: T | null | undefined): value is T {
  return value != null
}

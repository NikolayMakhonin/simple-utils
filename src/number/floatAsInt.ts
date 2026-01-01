import { fixFloat, roundFraction } from './round'

/** Safe converts an integer cents to float: 123 → 1.23 */
export function intAsFloat<T extends number | null | undefined>(
  value: T,
  decimals: number,
): T {
  if (value == null) {
    return null as T
  }
  return fixFloat(value * 10 ** -decimals) as T
}

/** Safe converts a float to integer cents: 1.23 → 123 */
export function floatAsInt<T extends number | null | undefined>(
  value: T,
  decimals: number,
): T {
  if (value == null) {
    return null as T
  }
  return roundFraction(value * 10 ** decimals) as T
}

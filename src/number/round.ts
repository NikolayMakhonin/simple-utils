export const MAX_FLOAT_PRECISION = 13

const ROUND = 0
const FLOOR = 1
const CEIL = 2

type RoundType = typeof ROUND | typeof FLOOR | typeof CEIL

const PRECISION = 0
const FRACTION = 1

type DigitsType = typeof PRECISION | typeof FRACTION

function _round(
  value: number,
  digits: number,
  digitsType: DigitsType,
  roundType: RoundType,
) {
  if (digitsType === PRECISION && digits <= 0) {
    throw new Error(`[number][round] Precision digits (${digits}) must be > 0`)
  }

  if (digitsType === FRACTION && digits < 0) {
    throw new Error(`[number][round] Fraction digits (${digits}) must be >= 0`)
  }

  if (!value) {
    return value
  }

  if (
    (digitsType === PRECISION && digits < MAX_FLOAT_PRECISION)
    || digitsType === FRACTION
  ) {
    value = fixFloat(value)
  }

  const negative = value < 0
  const valueAbs = negative ? -value : value
  const str = valueAbs.toExponential()
  const len = str.indexOf('e')

  let precisionDigits = digits

  let exponent: number | undefined
  if (digitsType === FRACTION) {
    exponent = parseInt(str.slice(len + 1), 10)
    precisionDigits += exponent + 1
  }

  let index = precisionDigits > 0 ? precisionDigits + 1 : precisionDigits

  if (index >= len) {
    return value
  }

  let ch = index < 0 ? 0 : str.charCodeAt(index) - 48

  let increment: boolean
  switch (roundType) {
    case ROUND:
      increment =
        ch > 5
        || (!negative && ch === 5)
        || (negative && ch === 5 && index < len - 1)
      break
    case FLOOR:
      increment = negative
      break
    case CEIL:
      increment = !negative
      break
    default:
      throw new Error(`Unexpected behavior`)
  }

  if (precisionDigits <= 0) {
    if (increment) {
      if (typeof exponent === 'undefined') {
        exponent = parseInt(str.slice(len + 1), 10)
      }
      return parseFloat(
        `${negative ? '-' : ''}1e${exponent - precisionDigits + 1}`,
      )
    }
    return negative ? -0 : 0
  }

  if (!increment) {
    return parseFloat(
      (negative ? '-' : '')
        + str.slice(0, index === 2 ? 1 : index)
        + str.slice(len),
    )
  }

  for (let nDigit = precisionDigits - 1; nDigit >= 0; nDigit--) {
    index = nDigit > 0 ? nDigit + 1 : nDigit
    ch = str.charCodeAt(index) - 48
    if (ch < 9) {
      return parseFloat(
        (negative ? '-' : '') + str.slice(0, index) + (ch + 1) + str.slice(len),
      )
    }
  }

  return parseFloat((negative ? '-' : '') + '10' + str.slice(len))
}

/** Safe rounding to N significant digits; prevents "messy" float tails in toString(). */
export function roundPrecision(value: number, digits: number) {
  return _round(value, digits, PRECISION, ROUND)
}

/** Safe floor to N significant digits; prevents "messy" float tails in toString(). */
export function floorPrecision(value: number, digits: number) {
  return _round(value, digits, PRECISION, FLOOR)
}

/** Safe ceil to N significant digits; prevents "messy" float tails in toString(). */
export function ceilPrecision(value: number, digits: number) {
  return _round(value, digits, PRECISION, CEIL)
}

/** Safe rounding to N decimal places; prevents "messy" float tails in toString(). */
export function roundFraction(value: number, fractionDigits?: number) {
  return _round(value, fractionDigits || 0, FRACTION, ROUND)
}

/** Safe floor to N decimal places; prevents "messy" float tails in toString(). */
export function floorFraction(value: number, fractionDigits?: number) {
  return _round(value, fractionDigits || 0, FRACTION, FLOOR)
}

/** Safe ceil to N decimal places; prevents "messy" float tails in toString(). */
export function ceilFraction(value: number, fractionDigits?: number) {
  return _round(value, fractionDigits || 0, FRACTION, CEIL)
}

/**
 * Safe cleanup float to prevent "messy" float tails in toString()
 * @example 0.0000000000001 => 0
 * @example 0.9999999999999 => 1
 */
export function fixFloat(value: number) {
  return roundPrecision(value, MAX_FLOAT_PRECISION)
}

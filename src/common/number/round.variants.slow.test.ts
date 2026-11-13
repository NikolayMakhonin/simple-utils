import { describe, it, expect } from 'vitest'
import {
  ceilFraction,
  ceilPrecision,
  fixFloat,
  floorFraction,
  floorPrecision,
  roundFraction,
  roundPrecision,
} from './round'
import { createTestVariants } from '@flemist/test-variants'

describe('round', () => {
  function createValue({
    lastDigits,
    countDigits,
    exponent,
    negative,
  }: {
    lastDigits: number
    countDigits: number
    exponent: number
    negative: boolean
  }) {
    if (countDigits === 0) {
      lastDigits = 0
    }
    if (countDigits === 1) {
      lastDigits = lastDigits + 5 - ((lastDigits + 5) % 10)
    }
    const digitsStr = lastDigits
      .toString()
      .padStart(Math.min(2, countDigits), '0')
      .padStart(countDigits, '9')
    const _exponent = exponent - countDigits
    const value = parseFloat(`${negative ? '-' : ''}${digitsStr}e${_exponent}`)
    return value
  }

  const testVariants = createTestVariants(
    ({
      lastDigits,
      countDigits,
      exponent,
      negative,
      value,
    }: {
      lastDigits: number
      countDigits: number
      exponent: number
      negative: boolean
      value: number
    }) => {
      // console.log(value)
      expect(fixFloat(value)).toBe(value)

      // roundPrecision
      expect(roundPrecision(value, countDigits)).toBe(value)
      expect(roundPrecision(value, countDigits + 1)).toBe(value)
      expect(roundPrecision(value, countDigits - 1)).toBe(
        createValue({
          lastDigits:
            countDigits >= 3 || lastDigits >= 10
              ? lastDigits + 5 - ((lastDigits + 5) % 10)
              : lastDigits,
          countDigits,
          exponent,
          negative,
        }),
      )

      if (negative) {
        return
      }

      // floorFraction
      if (countDigits >= exponent) {
        if (-exponent - 1 >= 0) {
          expect(floorFraction(value, -exponent - 1)).toBe(0)
        }
        if (-exponent - 2 >= 0) {
          expect(floorFraction(value, -exponent - 2)).toBe(0)
        }
        const fractionDigits = countDigits - exponent
        expect(floorFraction(value, fractionDigits)).toBe(value)
        expect(floorFraction(value, fractionDigits + 1)).toBe(value)
        if (fractionDigits > 0) {
          expect(floorFraction(value, fractionDigits - 1)).toBe(
            createValue({
              lastDigits: Math.floor(lastDigits / 10) * 10,
              countDigits,
              exponent,
              negative,
            }),
          )
        }
      }

      // ceilFraction
      if (countDigits >= exponent) {
        if (-exponent - 1 >= 0) {
          expect(ceilFraction(value, -exponent - 1)).toBe(
            value > 0 ? parseFloat(`1e${exponent + 1}`) : 0,
          )
        }
        if (-exponent - 2 >= 0) {
          expect(ceilFraction(value, -exponent - 2)).toBe(
            value > 0 ? parseFloat(`1e${exponent + 2}`) : 0,
          )
        }
        const fractionDigits = countDigits - exponent
        expect(ceilFraction(value, fractionDigits)).toBe(value)
        expect(ceilFraction(value, fractionDigits + 1)).toBe(value)
        if (fractionDigits > 0) {
          expect(ceilFraction(value, fractionDigits - 1)).toBe(
            createValue({
              lastDigits: Math.ceil(lastDigits / 10) * 10,
              countDigits,
              exponent,
              negative,
            }),
          )
        }
      }

      // roundFraction
      if (countDigits >= exponent) {
        if (-exponent - 1 >= 0) {
          expect(roundFraction(value, -exponent - 1)).toBe(
            value > parseFloat(`5e${exponent}`)
              ? parseFloat(`1e${exponent + 1}`)
              : 0,
          )
        }
        if (-exponent - 2 >= 0) {
          expect(roundFraction(value, -exponent - 2)).toBe(
            value > parseFloat(`5e${exponent}`)
              ? parseFloat(`1e${exponent + 2}`)
              : 0,
          )
        }
        const fractionDigits = countDigits - exponent
        expect(roundFraction(value, fractionDigits)).toBe(value)
        expect(roundFraction(value, fractionDigits + 1)).toBe(value)
        if (fractionDigits > 0) {
          expect(roundFraction(value, fractionDigits - 1)).toBe(
            createValue({
              lastDigits: Math.round(lastDigits / 10) * 10,
              countDigits,
              exponent,
              negative,
            }),
          )
        }
      }

      // floorPrecision
      expect(floorPrecision(value, countDigits)).toBe(value)
      expect(floorPrecision(value, countDigits + 1)).toBe(value)
      expect(floorPrecision(value, countDigits - 1)).toBe(
        createValue({
          lastDigits:
            countDigits >= 3 || lastDigits >= 10
              ? Math.floor(lastDigits / 10) * 10
              : lastDigits,
          countDigits,
          exponent,
          negative,
        }),
      )

      // ceilPrecision
      expect(ceilPrecision(value, countDigits)).toBe(value)
      expect(ceilPrecision(value, countDigits + 1)).toBe(value)
      expect(ceilPrecision(value, countDigits - 1)).toBe(
        createValue({
          lastDigits:
            countDigits >= 3 || lastDigits >= 10
              ? Math.ceil(lastDigits / 10) * 10
              : lastDigits,
          countDigits,
          exponent,
          negative,
        }),
      )
    },
  )

  // Не может эта функция покрыть все случаи,
  // а потому встает вопрос: нужна ли она
  it.skip('variants', async () => {
    await testVariants({
      lastDigits: Array.from({ length: 49 }, (_, i) => i),
      countDigits: Array.from({ length: 12 }, (_, i) => i + 2),
      exponent: Array.from({ length: 200 }, (_, i) => i - 100),
      negative: [false, true],
      value: ({ lastDigits, countDigits, exponent, negative }) => {
        return [createValue({ lastDigits, countDigits, exponent, negative })]
      },
    })()
  })
})

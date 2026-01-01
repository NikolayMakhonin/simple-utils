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

describe('round', function () {
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

  function testRound(
    func: (value: number) => number,
    input: number,
    expected: number,
  ) {
    const MIN_EPSILON = 1.1103e-16
    const MAX_EPSILON = 2.8486e-16

    if (input !== 0) {
      expect(input - input * MIN_EPSILON).not.toBe(input)
    }
    // expect(fixFloat(input + input * MAX_EPSILON)).toBe(input) // (-0) + (-0) = 0
    // expect(fixFloat(input - input * MAX_EPSILON)).toBe(
    //   Object.is(input, -0) ? 0 : input,
    // ) // (-0) - (-0) = 0

    expect(func(input)).toBe(expected)
    expect(func(input + input * MAX_EPSILON)).toBe(expected)
    expect(func(input - input * MAX_EPSILON)).toBe(
      Object.is(input, -0) ? 0 : expected,
    )
  }

  const test_roundPrecision = (
    input: number,
    precision: number,
    expected: number,
  ) => {
    testRound(o => roundPrecision(o, precision), input, expected)
  }

  const test_floorPrecision = (
    input: number,
    precision: number,
    expected: number,
  ) => {
    testRound(o => floorPrecision(o, precision), input, expected)
  }

  const test_ceilPrecision = (
    input: number,
    precision: number,
    expected: number,
  ) => {
    testRound(o => ceilPrecision(o, precision), input, expected)
  }

  const test_roundFraction = (
    input: number,
    fraction: number,
    expected: number,
  ) => {
    testRound(o => roundFraction(o, fraction), input, expected)
  }

  const test_floorFraction = (
    input: number,
    fraction: number,
    expected: number,
  ) => {
    testRound(o => floorFraction(o, fraction), input, expected)
  }

  const test_ceilFraction = (
    input: number,
    fraction: number,
    expected: number,
  ) => {
    testRound(o => ceilFraction(o, fraction), input, expected)
  }

  it('roundPrecision', () => {
    expect(Math.round(9.5)).toBe(10)
    expect(Math.round(-9.5)).toBe(-9)
    expect(Math.round(9.499999999)).toBe(9)
    expect(Math.round(-9.499999999)).toBe(-9)
    expect(Math.round(9.500000001)).toBe(10)
    expect(Math.round(-9.500000001)).toBe(-10)

    test_roundPrecision(0, 1, 0)
    // /expect\((\w+)\(([0-9.e-]+), ([0-9.e-]+)\)\)\.toBe\(([0-9.e-]+)\)/g
    // test_$1($2, $3, $4)
    test_roundPrecision(-0, 1, -0)
    test_roundPrecision(9, 1, 9)
    test_roundPrecision(-9, 1, -9)
    test_roundPrecision(9.5, 1, 10)
    test_roundPrecision(-9.5, 1, -9)
    test_roundPrecision(9.499999999, 1, 9)
    test_roundPrecision(-9.499999999, 1, -9)
    test_roundPrecision(9.999999999, 1, 10)
    test_roundPrecision(-9.999999999, 1, -10)
    test_roundPrecision(9.500000001, 1, 10)
    test_roundPrecision(-9.500000001, 1, -10)

    test_roundPrecision(9.0e-50, 1, 9.0e-50)
    test_roundPrecision(-9.0e-50, 1, -9.0e-50)
    test_roundPrecision(9.5e-50, 1, 1.0e-49)
    test_roundPrecision(-9.5e-50, 1, -9.0e-50)
    test_roundPrecision(9.499999999e-50, 1, 9.0e-50)
    test_roundPrecision(-9.499999999e-50, 1, -9.0e-50)
    test_roundPrecision(9.999999999e-50, 1, 1.0e-49)
    test_roundPrecision(-9.999999999e-50, 1, -1.0e-49)
    test_roundPrecision(9.500000001e-50, 1, 1.0e-49)
    test_roundPrecision(-9.500000001e-50, 1, -1.0e-49)
  })

  it('floorPrecision', () => {
    expect(Math.floor(9.0)).toBe(9)
    expect(Math.floor(-9.0)).toBe(-9)
    expect(Math.floor(9.0000001)).toBe(9)
    expect(Math.floor(-9.0000001)).toBe(-10)
    expect(Math.floor(9.9999999)).toBe(9)
    expect(Math.floor(-9.9999999)).toBe(-10)

    test_floorPrecision(0, 1, 0)
    test_floorPrecision(-0, 1, -0)
    test_floorPrecision(9, 1, 9)
    test_floorPrecision(-9, 1, -9)
    test_floorPrecision(9.0, 1, 9)
    test_floorPrecision(-9.0, 1, -9)
    test_floorPrecision(9.0000001, 1, 9)
    test_floorPrecision(-9.0000001, 1, -10)
    test_floorPrecision(9.9999999, 1, 9)
    test_floorPrecision(-9.9999999, 1, -10)

    test_floorPrecision(9.0e-50, 1, 9.0e-50)
    test_floorPrecision(-9.0e-50, 1, -9.0e-50)
    test_floorPrecision(9.0e-50, 1, 9.0e-50)
    test_floorPrecision(-9.0e-50, 1, -9.0e-50)
    test_floorPrecision(9.0000001e-50, 1, 9.0e-50)
    test_floorPrecision(-9.0000001e-50, 1, -1.0e-49)
    test_floorPrecision(9.9999999e-50, 1, 9.0e-50)
    test_floorPrecision(-9.9999999e-50, 1, -1.0e-49)
  })

  it('ceilPrecision', () => {
    expect(Math.ceil(9.0)).toBe(9)
    expect(Math.ceil(-9.0)).toBe(-9)
    expect(Math.ceil(9.0000001)).toBe(10)
    expect(Math.ceil(-9.0000001)).toBe(-9)
    expect(Math.ceil(9.9999999)).toBe(10)
    expect(Math.ceil(-9.9999999)).toBe(-9)

    test_ceilPrecision(0, 1, 0)
    test_ceilPrecision(-0, 1, -0)
    test_ceilPrecision(9, 1, 9)
    test_ceilPrecision(-9, 1, -9)
    test_ceilPrecision(9.0, 1, 9)
    test_ceilPrecision(-9.0, 1, -9)
    test_ceilPrecision(9.0000001, 1, 10)
    test_ceilPrecision(-9.0000001, 1, -9)
    test_ceilPrecision(9.9999999, 1, 10)
    test_ceilPrecision(-9.9999999, 1, -9)

    test_ceilPrecision(9.0e-50, 1, 9.0e-50)
    test_ceilPrecision(-9.0e-50, 1, -9.0e-50)
    test_ceilPrecision(9.0e-50, 1, 9.0e-50)
    test_ceilPrecision(-9.0e-50, 1, -9.0e-50)
    test_ceilPrecision(9.0000001e-50, 1, 1.0e-49)
    test_ceilPrecision(-9.0000001e-50, 1, -9.0e-50)
    test_ceilPrecision(9.9999999e-50, 1, 1.0e-49)
    test_ceilPrecision(-9.9999999e-50, 1, -9.0e-50)
  })

  it('roundFraction', () => {
    expect(Math.round(-0)).toBe(-0)
    expect(Math.round(-0.1)).toBe(-0)
    expect(Math.round(9.5)).toBe(10)
    expect(Math.round(-9.5)).toBe(-9)
    expect(Math.round(9.499999999)).toBe(9)
    expect(Math.round(-9.499999999)).toBe(-9)
    expect(Math.round(9.500000001)).toBe(10)
    expect(Math.round(-9.500000001)).toBe(-10)

    test_roundFraction(0, 0, 0)
    test_roundFraction(-0, 0, -0)
    test_roundFraction(0.1, 0, 0)
    test_roundFraction(-0.1, 0, -0)
    test_roundFraction(9, 0, 9)
    test_roundFraction(-9, 0, -9)
    test_roundFraction(9.5, 0, 10)
    test_roundFraction(-9.5, 0, -9)
    test_roundFraction(9.499999999, 0, 9)
    test_roundFraction(-9.499999999, 0, -9)
    test_roundFraction(9.500000001, 0, 10)
    test_roundFraction(-9.500000001, 0, -10)

    test_roundFraction(0, 0, 0)
    test_roundFraction(-0, 0, -0)
    test_roundFraction(0.5, 0, 1)
    test_roundFraction(-0.5, 0, -0)
    test_roundFraction(0.499999999, 0, 0)
    test_roundFraction(-0.499999999, 0, -0)
    test_roundFraction(0.500000001, 0, 1)
    test_roundFraction(-0.500000001, 0, -1)

    test_roundFraction(0.09, 0, 0)
    test_roundFraction(-0.09, 0, -0)
    test_roundFraction(9.0e-10, 0, 0)
    test_roundFraction(-9.0e-10, 0, -0)
  })

  it('floorFraction', () => {
    expect(Math.floor(-0)).toBe(-0)
    expect(Math.floor(-0.1)).toBe(-1)
    expect(Math.floor(9.5)).toBe(9)
    expect(Math.floor(-9.5)).toBe(-10)
    expect(Math.floor(9.499999999)).toBe(9)
    expect(Math.floor(-9.499999999)).toBe(-10)
    expect(Math.floor(9.500000001)).toBe(9)
    expect(Math.floor(-9.500000001)).toBe(-10)

    test_floorFraction(0, 0, 0)
    test_floorFraction(-0, 0, -0)
    test_floorFraction(0.1, 0, 0)
    test_floorFraction(-0.1, 0, -1)
    test_floorFraction(9, 0, 9)
    test_floorFraction(-9, 0, -9)
    test_floorFraction(9.5, 0, 9)
    test_floorFraction(-9.5, 0, -10)
    test_floorFraction(9.499999999, 0, 9)
    test_floorFraction(-9.499999999, 0, -10)
    test_floorFraction(9.500000001, 0, 9)
    test_floorFraction(-9.500000001, 0, -10)

    test_floorFraction(0.9, 0, 0)
    test_floorFraction(-0.9, 0, -1)
    test_floorFraction(9.0e-10, 0, 0)
    test_floorFraction(-9.0e-10, 0, -1)
  })

  it('ceilFraction', () => {
    expect(Math.ceil(-0)).toBe(-0)
    expect(Math.ceil(-0.1)).toBe(-0)
    expect(Math.ceil(9.5)).toBe(10)
    expect(Math.ceil(-9.5)).toBe(-9)
    expect(Math.ceil(9.499999999)).toBe(10)
    expect(Math.ceil(-9.499999999)).toBe(-9)
    expect(Math.ceil(9.500000001)).toBe(10)
    expect(Math.ceil(-9.500000001)).toBe(-9)

    test_ceilFraction(0, 0, 0)
    test_ceilFraction(-0, 0, -0)
    test_ceilFraction(0.1, 0, 1)
    test_ceilFraction(-0.1, 0, -0)
    test_ceilFraction(9, 0, 9)
    test_ceilFraction(-9, 0, -9)
    test_ceilFraction(9.5, 0, 10)
    test_ceilFraction(-9.5, 0, -9)
    test_ceilFraction(9.499999999, 0, 10)
    test_ceilFraction(-9.499999999, 0, -9)
    test_ceilFraction(9.500000001, 0, 10)
    test_ceilFraction(-9.500000001, 0, -9)

    test_ceilFraction(0.09, 0, 1)
    test_ceilFraction(-0.09, 0, -0)
    test_ceilFraction(9.0e-10, 0, 1)
    test_ceilFraction(-9.0e-10, 0, -0)
  })

  it('extra', () => {
    expect(fixFloat(49.34000000000001)).toBe(49.34)

    test_floorFraction(0.00000011111, 2, 0)
    test_floorFraction(0.011111, 2, 0.01)
    test_ceilFraction(0.0000001, 2, 0.01)
    test_ceilFraction(0.0100001, 2, 0.02)
    test_roundFraction(0.0000001, 2, 0)
    test_roundFraction(0.0049999, 2, 0)
    test_roundFraction(0.005, 2, 0.01)
    test_roundFraction(0.0149999, 2, 0.01)
    test_roundFraction(0.015, 2, 0.02)

    test_floorFraction(111 * 1.18, 2, 130.98)

    test_roundPrecision(111, 1, 100)
    test_roundPrecision(111, 2, 110)
    test_roundPrecision(0.1, 1, 0.1)
    test_roundPrecision(0.01, 1, 0.01)
    test_roundPrecision(0.999, 2, 1)
    test_roundPrecision(9.05e-97, 2, 9.1e-97)
    // test_roundPrecision(0.099999999999964, 13, 0.09999999999996)
    // test_roundPrecision(0.099999999999964, 12, 0.1)
    test_roundPrecision(0.01 * 1.01 - 0.01, 13, 0.0001)
    // test_roundPrecision(10.00000000000001, 1, 10)
    test_roundPrecision(1.05e-200, 5, 1.05e-200)
    test_roundPrecision(1.05e-50, 5, 1.05e-50)
  })

  it('variants', async () => {
    await testVariants({
      lastDigits : Array.from({ length: 49 }, (_, i) => i),
      countDigits: Array.from({ length: 14 }, (_, i) => i + 2),
      exponent   : Array.from({ length: 200 }, (_, i) => i - 100),
      negative   : [false, true],
      value      : ({ lastDigits, countDigits, exponent, negative }) => {
        return [createValue({ lastDigits, countDigits, exponent, negative })]
      },
    })()
  })
})

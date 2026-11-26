import { describe, it, expect } from 'vitest'
import { isPrime, nextPrime, prevPrime } from './prime'

describe('prime', () => {
  it('base', () => {
    expect(isPrime(-7)).toBe(false)
    expect(isPrime(0)).toBe(false)
    expect(isPrime(1)).toBe(false)
    expect(isPrime(2)).toBe(true)
    expect(isPrime(3)).toBe(true)
    expect(isPrime(4)).toBe(false)
    expect(isPrime(25)).toBe(false)
    expect(isPrime(29)).toBe(true)
    expect(isPrime(2147483647)).toBe(true)

    expect(nextPrime(-1)).toBe(2)
    expect(nextPrime(1)).toBe(2)
    expect(nextPrime(2)).toBe(3)
    expect(nextPrime(3)).toBe(5)
    expect(nextPrime(24)).toBe(29)
    expect(nextPrime(2147483646)).toBe(2147483647)

    expect(prevPrime(-1)).toBe(null)
    expect(prevPrime(2)).toBe(null)
    expect(prevPrime(3)).toBe(2)
    expect(prevPrime(4)).toBe(3)
    expect(prevPrime(29)).toBe(23)
    expect(prevPrime(30)).toBe(29)
  })

  it('non-integers and large negatives', () => {
    expect(isPrime(2.5)).toBe(false)
    expect(isPrime(NaN)).toBe(false)
    expect(isPrime(-Infinity)).toBe(false)
    expect(isPrime(-2147483649)).toBe(false)

    expect(nextPrime(1.5)).toBe(2)
    expect(nextPrime(2.5)).toBe(3)
    expect(nextPrime(7.5)).toBe(11)
    expect(nextPrime(NaN)).toBe(2)
    expect(nextPrime(-3e9)).toBe(2)

    expect(prevPrime(2.5)).toBe(2)
    expect(prevPrime(7.5)).toBe(7)
    expect(prevPrime(8.5)).toBe(7)
    expect(prevPrime(NaN)).toBe(null)
    expect(prevPrime(-3e9)).toBe(null)
  })

  it('errors', () => {
    expect(() => isPrime(2147483648)).toThrow()
    expect(() => isPrime(Infinity)).toThrow()
    expect(() => nextPrime(2147483647)).toThrow()
    expect(() => prevPrime(2147483648)).toThrow()
  })

  it('every number below 1000000 against trial division', () => {
    const primeNumbers: number[] = []
    const wrongCalls: string[] = []
    for (let i = 2; i < 1000000; i++) {
      let isPrimeExpected = true
      for (
        let j = 0;
        j < primeNumbers.length && primeNumbers[j] * primeNumbers[j] <= i;
        j++
      ) {
        if (i % primeNumbers[j] === 0) {
          isPrimeExpected = false
          break
        }
      }
      if (isPrime(i) !== isPrimeExpected) {
        wrongCalls.push(`isPrime(${i})`)
      }
      if (isPrimeExpected) {
        if (primeNumbers.length >= 1) {
          const primePrev = primeNumbers[primeNumbers.length - 1]
          if (nextPrime(primePrev) !== i) {
            wrongCalls.push(`nextPrime(${primePrev})`)
          }
          if (prevPrime(i) !== primePrev) {
            wrongCalls.push(`prevPrime(${i})`)
          }
        }
        primeNumbers.push(i)
      }
    }
    expect(wrongCalls).toEqual([])
    expect(primeNumbers.length).toBe(78498)
  })
})

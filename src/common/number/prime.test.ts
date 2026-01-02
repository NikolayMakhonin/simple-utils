import { describe, it, assert } from 'vitest'
import { isPrime, nextPrime, prevPrime } from './prime'

describe('test-variants > prime', () => {
  it(
    'isPrime',
    async function () {
      const primeNumbers: number[] = []
      for (let i = 2; i < 1000000; i++) {
        let _isPrime = true
        for (let j = 0; j < primeNumbers.length; j++) {
          if (i % primeNumbers[j] === 0) {
            _isPrime = false
            break
          }
        }
        assert.strictEqual(isPrime(i), _isPrime)
        if (_isPrime) {
          if (primeNumbers.length >= 1) {
            assert.strictEqual(
              nextPrime(primeNumbers[primeNumbers.length - 1]),
              i,
            )
            assert.strictEqual(
              prevPrime(i),
              primeNumbers[primeNumbers.length - 1],
            )
          }
          primeNumbers.push(i)
        }
      }
      console.log(primeNumbers.length)
    },
    10 * 60 * 1000,
  )
})

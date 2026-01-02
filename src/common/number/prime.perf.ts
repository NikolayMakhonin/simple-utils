import { describe, it } from 'vitest'
import { calcPerformance } from 'rdtsc/node'
import { nextPrime, prevPrime } from './prime'

describe('test-variants > prime perf', () => {
  it('isPrime', function () {
    let number1 = nextPrime(2 ** 30)
    let number2 = prevPrime(2 ** 31 - 1)
    console.log('number:', number1)
    console.log('number:', number2)
    const result = calcPerformance({
      time: 10000,
      funcs: [
        () => {},
        () => {
          number1 = nextPrime(number1)
        },
        () => {
          number2 = prevPrime(number2!)
        },
      ],
    })

    console.log('number1:', number1)
    console.log('number2:', number2)
    console.log('perf:', result)
  }, 300000)
})

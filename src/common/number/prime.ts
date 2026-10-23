const MAX_NUMBER = (2 ** 31 - 1) | 0
const MAX_NUMBER_PRIME = 2147483647

export function isPrime(n: number) {
  if (n > MAX_NUMBER) {
    throw new Error(`Number is too large: ${n}, max is ${MAX_NUMBER}`)
  }
  // non-integers and numbers below -2^31 are not primes
  if ((n | 0) !== n) {
    return false
  }
  // convert number to 32-bit integer for performance
  n = n | 0
  if (n <= 1) {
    return false
  }
  if (n <= 3) {
    return true
  }
  if (n % 2 === 0 || n % 3 === 0) {
    return false
  }
  for (let i = 5; i * i <= n; i += 6) {
    if (n % i === 0 || n % (i + 2) === 0) {
      return false
    }
  }
  return true
}

export function nextPrime(n: number) {
  if (n >= MAX_NUMBER_PRIME) {
    throw new Error(`Number is too large: ${n}, max is ${MAX_NUMBER_PRIME - 1}`)
  }
  // !(n >= 2) is also true for NaN
  if (!(n >= 2)) {
    return 2
  }
  // convert number to 32-bit integer for performance
  n = n | 0
  let candidate = n + (n % 2 === 0 ? 1 : 2)
  while (!isPrime(candidate)) {
    candidate += 2
  }
  return candidate
}

export function prevPrime(n: number) {
  if (n > MAX_NUMBER) {
    throw new Error(`Number is too large: ${n}, max is ${MAX_NUMBER}`)
  }
  // !(n > 2) is also true for NaN
  if (!(n > 2)) {
    return null
  }
  // the largest prime below a fractional n is the largest prime below its ceiling
  // convert number to 32-bit integer for performance
  n = Math.ceil(n) | 0
  let candidate = n - (n % 2 === 0 ? 1 : 2)
  while (candidate > 2 && !isPrime(candidate)) {
    candidate -= 2
  }
  if (candidate > 2) {
    return candidate
  }
  return 2
}

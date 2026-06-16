export class PoolHoldError extends Error {
  readonly count: number

  constructor(count: number) {
    super(`[PoolHoldError] hold(${count}) failed`)
    // see: https://github.com/Microsoft/TypeScript/wiki/Breaking-Changes#extending-built-ins-like-error-array-and-map-may-no-longer-work
    Object.setPrototypeOf(this, PoolHoldError.prototype)
    this.name = 'PoolHoldError'
    this.count = count
  }
}

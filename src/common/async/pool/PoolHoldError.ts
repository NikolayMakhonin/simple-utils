export class PoolHoldError extends Error {
  readonly count: number

  constructor(count: number) {
    super(`Pool hold(${count}) failed`)

    this.count = count
  }
}

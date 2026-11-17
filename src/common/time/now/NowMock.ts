import type { INow } from './contracts'

export class NowMock implements INow {
  #now: number = 0
  #nowUnique: number = 0

  setTime(time: number): void {
    this.#now = time
  }

  now(): number {
    return this.#now
  }

  nowUnique(): number {
    const next = Math.max(this.#nowUnique, this.#now) + 1
    this.#nowUnique = next
    return next
  }
}

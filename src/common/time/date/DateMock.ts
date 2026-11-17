import { type ITime, TimeMock } from '../time'
import type { IDate } from './contracts'

export type DateMockOptions = {
  /** Advances now() by the time it counts. Default: now() changes only by setNow() */
  time?: null | ITime
}

export class DateMock implements IDate {
  readonly #time: ITime
  #dateSet: number = 0
  #timeSet: number
  #nowUnique: number = 0

  constructor(options?: null | DateMockOptions) {
    this.#time = options?.time ?? new TimeMock()
    this.#timeSet = this.#time.time()
  }

  setNow(now: number): void {
    this.#dateSet = now
    this.#timeSet = this.#time.time()
  }

  now(): number {
    return this.#dateSet + this.#time.time() - this.#timeSet
  }

  nowUnique(): number {
    const next = Math.max(this.#nowUnique, this.now()) + 1
    this.#nowUnique = next
    return next
  }
}

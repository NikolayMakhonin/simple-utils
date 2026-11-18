import { type IClockTime, ClockTimeMock } from '../clock-time'
import type { IClockDate } from './contracts'

export type ClockDateMockOptions = {
  /** Advances value() by the time it counts. Default: value() changes only by setValue() */
  clockTime?: null | IClockTime
}

export class ClockDateMock implements IClockDate {
  readonly #clockTime: IClockTime
  #dateSet: number = 0
  #timeSet: number
  #dateUnique: number = 0

  constructor(options?: null | ClockDateMockOptions) {
    this.#clockTime = options?.clockTime ?? new ClockTimeMock()
    this.#timeSet = this.#clockTime.value()
  }

  setValue(date: number): void {
    this.#dateSet = date
    this.#timeSet = this.#clockTime.value()
  }

  value(): number {
    return this.#dateSet + this.#clockTime.value() - this.#timeSet
  }

  valueUnique(): number {
    const next = Math.max(this.#dateUnique, this.value()) + 1
    this.#dateUnique = next
    return next
  }
}

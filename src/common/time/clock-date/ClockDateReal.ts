import type { NumberRange } from 'src/common/types'
import { type IClockTime, clockTimeReal } from '../clock-time'
import type { IClockDate } from './contracts'

export type ClockDateRealOptions = {
  /** Counts the time between updates. Default: clockTimeReal */
  clockTime?: null | IClockTime
}

/** Like Date.now(), but can be corrected to real time */
export class ClockDateReal implements IClockDate {
  readonly #clockTime: IClockTime
  #dateUnique: number = 0
  #dateBase: number | null = null
  #timeBase: number = 0
  #dateReading: number = 0
  #timeReading: number = 0
  #dateMinimum: number | null = null
  #timeDateMinimum: number = 0

  constructor(options?: null | ClockDateRealOptions) {
    this.#clockTime = options?.clockTime ?? clockTimeReal
  }

  /** Milliseconds that value() adds to Date.now() at this moment, or null before the first update */
  get offset(): number | null {
    if (this.#dateBase == null) {
      return null
    }
    return this.value() - Date.now()
  }

  /** Lower bound of real time from the updates, or null before an update gives one */
  get dateMinimum(): number | null {
    if (this.#dateMinimum == null) {
      return null
    }
    return Math.floor(
      this.#dateMinimum + this.#clockTime.value() - this.#timeDateMinimum,
    )
  }

  /**
   * Corrects value() by a measured range of real time.
   * If value() lies outside the range, moves it into the range.
   * Sets dateMinimum to the lower end of the range.
   * Call it right after the measurement, because real time leaves the range while other code runs
   */
  updateDate(range: NumberRange): void {
    const [from, to] = range
    const date = this.value()
    this.#setValue(date < from || date > to ? (from + to) / 2 : date)
    this.#dateMinimum = from
    this.#timeDateMinimum = this.#clockTime.value()
  }

  /**
   * Sets offset and dateMinimum.
   * After the call, value() is Date.now() plus offset, but not less than dateMinimum
   */
  updateOffset(offset: number, dateMinimum: number | null): void {
    if (!Number.isFinite(offset)) {
      throw new Error(
        `[ClockDateReal][updateOffset] offset (${offset}) should be a finite number`,
      )
    }
    if (dateMinimum != null && !Number.isFinite(dateMinimum)) {
      throw new Error(
        `[ClockDateReal][updateOffset] dateMinimum (${dateMinimum}) should be a finite number or null`,
      )
    }
    const date = Date.now() + offset
    this.#setValue(
      dateMinimum != null && date < dateMinimum ? dateMinimum : date,
    )
    this.#dateMinimum = dateMinimum
    this.#timeDateMinimum = this.#clockTime.value()
  }

  value(): number {
    if (this.#dateBase == null) {
      return Date.now()
    }
    const date = Date.now()
    const time = this.#clockTime.value()
    // The time of a sleep must count, and a device clock set forward
    // cannot be told apart from a sleep
    const dateJump = date - this.#dateReading - (time - this.#timeReading)
    if (dateJump > DATE_JUMP_MINIMUM) {
      this.#dateBase += dateJump
    }
    this.#dateReading = date
    this.#timeReading = time
    return Math.floor(this.#dateBase + time - this.#timeBase)
  }

  /**
   * Like value(), but greater by at least 1 than value() and than the previous result.
   * If an update sets value() more than 10 minutes below the previous result, the next result is value() + 1
   */
  valueUnique(): number {
    const next = Math.max(this.#dateUnique, this.value()) + 1
    this.#dateUnique = next
    return next
  }

  /** Sets value() to the given value at this moment */
  #setValue(date: number): void {
    const time = this.#clockTime.value()
    this.#dateBase = date
    this.#timeBase = time
    this.#dateReading = Date.now()
    this.#timeReading = time
    // After an update moves value() far back, valueUnique() restarts from value().
    // Otherwise valueUnique() would stay above value() by the whole move for as long as this ClockDateReal exists
    if (this.#dateUnique - date > DATE_UNIQUE_AHEAD_MAXIMUM) {
      console.warn(
        `[ClockDateReal][setValue] value() moved back below the last valueUnique() by ${this.#dateUnique - date} ms`,
      )
      this.#dateUnique = 0
    }
  }
}

export const clockDateReal = /* @__PURE__ */ new ClockDateReal()

// A second: far above the rounding of Date.now() and performance.now().
// Ignoring a smaller jump leaves value() off by at most a second.
// That is the precision of internet time
/** When Date.now() gets ahead of the elapsed time by more than this, it counts as a sleep or a device clock set forward */
export const DATE_JUMP_MINIMUM = 1000

// Ten minutes: an update that moves value() back by more means a wrong device clock, not drift.
// After a smaller move back, valueUnique() stays strictly increasing
/** How far valueUnique() can stay ahead of value() after an update. Beyond it, valueUnique() restarts from value() */
const DATE_UNIQUE_AHEAD_MAXIMUM = 10 * 60 * 1000

import { ClockDateMock } from '../clock-date'
import { ClockTimeMock } from '../clock-time'
import type { IClock } from './contracts'

/** A ClockDateMock and a ClockTimeMock, where the date advances together with the time */
export class ClockMock implements IClock {
  readonly date: ClockDateMock
  readonly time: ClockTimeMock

  constructor() {
    this.time = new ClockTimeMock()
    this.date = new ClockDateMock({ clockTime: this.time })
  }
}

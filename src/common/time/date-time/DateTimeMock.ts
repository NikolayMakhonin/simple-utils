import { DateMock } from '../date'
import { TimeMock } from '../time'
import type { IDateTime } from './contracts'

/** A DateMock and a TimeMock, where date.now() advances together with time.time() */
export class DateTimeMock implements IDateTime {
  readonly date: DateMock
  readonly time: TimeMock

  constructor() {
    this.time = new TimeMock()
    this.date = new DateMock({ time: this.time })
  }
}

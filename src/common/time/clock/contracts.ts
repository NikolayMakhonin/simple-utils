import type { IClockDate } from '../clock-date'
import type { IClockTime } from '../clock-time'

export interface IClock {
  readonly date: IClockDate
  readonly time: IClockTime
}

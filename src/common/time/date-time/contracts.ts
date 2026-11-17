import type { IDate } from '../date'
import type { ITime } from '../time'

export interface IDateTime {
  readonly date: IDate
  readonly time: ITime
}

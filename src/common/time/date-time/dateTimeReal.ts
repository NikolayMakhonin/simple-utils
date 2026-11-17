import { dateReal } from '../date'
import { timeReal } from '../time'
import type { IDateTime } from './contracts'

export const dateTimeReal: IDateTime = { date: dateReal, time: timeReal }

import { clockDateReal } from '../clock-date'
import { clockTimeReal } from '../clock-time'
import type { IClock } from './contracts'

export const clockReal: IClock = { date: clockDateReal, time: clockTimeReal }

import { dateReal } from 'src/common/time/date'

export function generateTempFileName(): string {
  return `${dateReal.now().toString(36)}${Math.random().toString(36).substring(2)}.tmp`
}

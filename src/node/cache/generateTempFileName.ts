import { clockDateReal } from 'src/common/time/clock-date'

export function generateTempFileName(): string {
  return `${clockDateReal.value().toString(36)}${Math.random().toString(36).substring(2)}.tmp`
}

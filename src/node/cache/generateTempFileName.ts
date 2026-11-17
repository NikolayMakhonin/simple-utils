import { nowReal } from 'src/common/time/now'

export function generateTempFileName(): string {
  return `${nowReal.now().toString(36)}${Math.random().toString(36).substring(2)}.tmp`
}

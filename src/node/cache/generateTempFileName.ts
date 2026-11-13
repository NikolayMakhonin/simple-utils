import { timeControllerDefault } from 'src/common/time/time-controller'

export function generateTempFileName(): string {
  return `${timeControllerDefault.now().toString(36)}${Math.random().toString(36).substring(2)}.tmp`
}

import type { EnumOf } from 'src/common/types/common'

export type LogLevel = EnumOf<typeof LogLevel>
export const LogLevel = {
  none: 0,
  error: 1,
  warn: 2,
  debug: 3,
} as const

import type { Converter } from './types'

export const setArrayConverter: Converter<Set<any>, Array<any>> = {
  to: o => Array.from(o),
  from: o => new Set(o),
}

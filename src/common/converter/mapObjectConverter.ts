import type { Converter } from './types'

export const mapObjectConverter: Converter<
  Map<string, any>,
  Record<string, any>
> = {
  to: o => {
    return Array.from(o.entries()).reduce((acc, [key, value]) => {
      acc[key] = value
      return acc
    }, {} as any)
  },
  from: o => {
    return new Map(Object.entries(o))
  },
}

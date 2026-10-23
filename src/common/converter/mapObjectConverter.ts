import type { Converter } from './types'
import { setOwnProperty } from 'src/common/object/setOwnProperty'

export const mapObjectConverter: Converter<
  Map<string, any>,
  Record<string, any>
> = {
  to: o => {
    const result: Record<string, any> = {}
    o.forEach((value, key) => {
      setOwnProperty(result, key, value)
    })
    return result
  },
  from: o => {
    const result = new Map<string, any>()
    for (const key in o) {
      if (Object.prototype.hasOwnProperty.call(o, key)) {
        result.set(key, o[key])
      }
    }
    return result
  },
}

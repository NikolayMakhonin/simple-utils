import type { Converter } from './types'

export const converterStringToBuffer: Converter<string, Uint8Array> = {
  to: (value: string) => {
    return new TextEncoder().encode(value)
  },
  from: (value: Uint8Array) => {
    return new TextDecoder().decode(value)
  },
}

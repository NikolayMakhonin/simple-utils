import type { Converter } from './types'

let textEncoder: TextEncoder | null = null
let textDecoder: TextDecoder | null = null

export const converterStringToBuffer: Converter<string, Uint8Array> = {
  to: (value: string) => {
    if (textEncoder == null) {
      textEncoder = new TextEncoder()
    }
    return textEncoder.encode(value)
  },
  from: (value: Uint8Array) => {
    if (textDecoder == null) {
      // Invalid bytes must throw and a leading BOM must stay:
      // replacing them or removing it would silently change the value
      textDecoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })
    }
    return textDecoder.decode(value)
  },
}

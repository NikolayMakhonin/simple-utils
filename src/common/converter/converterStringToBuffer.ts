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
      // With fatal, invalid UTF-8 throws instead of turning into U+FFFD.
      // With ignoreBOM, a leading BOM stays instead of being removed.
      // Without these options, from() would silently return a changed string
      textDecoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })
    }
    return textDecoder.decode(value)
  },
}

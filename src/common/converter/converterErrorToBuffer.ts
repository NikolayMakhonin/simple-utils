import type { ConverterAsync } from './types'
import { formatAny } from 'src/common/string'
import { converterStringToBuffer } from './converterStringToBuffer'

export const converterErrorToBuffer: ConverterAsync<any, Uint8Array> = {
  to: (value: any) => {
    const error = formatAny(value, {
      pretty: true,
      maxDepth: 10,
      maxItems: 50,
      maxStringLength: 1000,
    })
    return converterStringToBuffer.to(error)
  },
  from: (value: Uint8Array) => {
    return converterStringToBuffer.from(value)
  },
}

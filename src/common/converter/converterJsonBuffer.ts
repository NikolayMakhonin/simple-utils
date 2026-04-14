import { type ConverterAsync } from './types'
import { converterStringToBuffer } from './converterStringToBuffer'
import { converterJson } from './converterJson'

export const converterJsonBuffer: ConverterAsync<any, Uint8Array> = {
  to: (value: any) => {
    const json = converterJson.to(value)
    return converterStringToBuffer.to(json)
  },
  from: (value: Uint8Array) => {
    const json = converterStringToBuffer.from(value)
    return converterJson.from(json)
  },
}

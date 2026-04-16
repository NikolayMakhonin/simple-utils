import { type ConverterAsync } from './types'
import { converterJsonBuffer } from './converterJsonBuffer'
import { createConverterBufferToGzip } from './converterBufferToGzip'
import { type CompressGzipOptions } from 'src/common/gzip/compressGzip'

/** @param options null/undefined disables gzip, including decompression */
export function createConverterJsonGzip(
  options: CompressGzipOptions | null | undefined,
): ConverterAsync<any, Uint8Array> {
  const converterBufferToGzip = createConverterBufferToGzip(options)
  return {
    to: (value: any) => {
      const buffer = converterJsonBuffer.to(value)
      return converterBufferToGzip.to(buffer)
    },
    from: async (value: Uint8Array) => {
      const buffer = await converterBufferToGzip.from(value)
      return converterJsonBuffer.from(buffer)
    },
  }
}

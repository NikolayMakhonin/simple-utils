import { type ConverterAsync } from './types'
import { converterErrorToBuffer } from './converterErrorToBuffer'
import { createConverterBufferToGzip } from './converterBufferToGzip'
import { type CompressGzipOptions } from 'src/common/gzip/compressGzip'

/** @param options null/undefined disables gzip, including decompression */
export function createConverterErrorToGzip(
  options: null | undefined | CompressGzipOptions,
): ConverterAsync<any, Uint8Array> {
  const converterBufferToGzip = createConverterBufferToGzip(options)
  return {
    to: (value: any) => {
      const buffer = converterErrorToBuffer.to(value)
      return converterBufferToGzip.to(buffer)
    },
    from: async (value: Uint8Array) => {
      const buffer = await converterBufferToGzip.from(value)
      return converterErrorToBuffer.from(buffer)
    },
  }
}

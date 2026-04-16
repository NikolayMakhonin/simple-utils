import { type ConverterAsync } from './types'
import {
  compressGzip,
  type CompressGzipOptions,
} from 'src/common/gzip/compressGzip'
import { decompressGzip } from 'src/common/gzip/decompressGzip'

/** @param options null/undefined disables gzip, including decompression */
export function createConverterBufferToGzip(
  options: CompressGzipOptions | null | undefined,
): ConverterAsync<Uint8Array, Uint8Array> {
  return {
    to: (value: Uint8Array) => {
      if (options == null) {
        return value
      }
      return compressGzip(value, options)
    },
    from: (value: Uint8Array) => {
      if (options == null) {
        return value
      }
      return decompressGzip(value)
    },
  }
}

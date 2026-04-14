import { gzip } from 'fflate'

/**
 * The level of compression to use, ranging from 0-9.
 *
 * 0 will store the data without compression.
 * 1 is fastest but compresses the worst, 9 is slowest but compresses the best.
 * The default level is 6.
 *
 * Typically, binary data benefits much more from higher values than text data.
 * In both cases, higher values usually take disproportionately longer than the reduction in final size that results.
 *
 * For example, a 1 MB text file could:
 * - become 1.01 MB with level 0 in 1ms
 * - become 400 kB with level 1 in 10ms
 * - become 320 kB with level 9 in 100ms
 */
export type CompressLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

export type CompressGzipOptions = {
  level: CompressLevel
}

/**
 * The level of compression to use, ranging from 0-9.
 *
 * 0 will store the data without compression.
 * 1 is fastest but compresses the worst, 9 is slowest but compresses the best.
 * The default level is 6.
 *
 * Typically, binary data benefits much more from higher values than text data.
 * In both cases, higher values usually take disproportionately longer than the reduction in final size that results.
 *
 * For example, a 1 MB text file could:
 * - become 1.01 MB with level 0 in 1ms
 * - become 400 kB with level 1 in 10ms
 * - become 320 kB with level 9 in 100ms
 */
export async function compressGzip(
  buffer: Uint8Array,
  options: CompressGzipOptions,
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    gzip(buffer, { level: options.level }, (error, compressed) => {
      if (error) {
        reject(error)
      } else {
        resolve(compressed)
      }
    })
  })
}

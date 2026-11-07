import { gzipSync } from 'fflate'

export type CompressLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

export type CompressGzipOptions = {
  /**
   * The level of compression to use, ranging from 0-9.
   *
   * 0 will store the data without compression.
   * 1 is fastest but compresses the worst, 9 is slowest but compresses the best.
   *
   * Typically, binary data benefits much more from higher values than text data.
   * In both cases, higher values usually take disproportionately longer than the reduction in final size that results.
   *
   * For example, a 1 MB text file could:
   * - become 1.01 MB with level 0 in 1ms
   * - become 400 kB with level 1 in 10ms
   * - become 320 kB with level 9 in 100ms
   */
  level: CompressLevel
}

export function compressGzip(
  buffer: Uint8Array,
  options: CompressGzipOptions,
): Uint8Array {
  // Without mtime the header contains the current time,
  // so equal data would compress to different bytes
  return gzipSync(buffer, { level: options.level, mtime: 0 })
}

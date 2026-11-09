import { gzipSync } from 'fflate'

export type CompressLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

export type CompressGzipOptions = {
  /**
   * Level 0 stores the data without compression.
   * Level 1 is the fastest and compresses the worst, level 9 is the slowest and compresses the best.
   * Binary data gains much more from higher levels than text. The time grows much faster
   * than the size shrinks: a 1 MB text file becomes about 1.01 MB at level 0 in 1 ms,
   * 400 kB at level 1 in 10 ms, 320 kB at level 9 in 100 ms
   */
  level: CompressLevel
}

export function compressGzip(
  buffer: Uint8Array,
  options: CompressGzipOptions,
): Uint8Array {
  // Without mtime: 0, the gzip header gets the current time,
  // so equal data compresses to different bytes
  return gzipSync(buffer, { level: options.level, mtime: 0 })
}

import { gunzipSync } from 'fflate'

export function isGzipCompressed(data) {
  return data[0] === 0x1f && data[1] === 0x8b
}

export function decompressGzip(buffer: Uint8Array): Uint8Array {
  return gunzipSync(buffer)
}

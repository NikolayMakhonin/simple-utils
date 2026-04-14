import { gunzip } from 'fflate'

export function isGzipCompressed(data) {
  return data[0] === 0x1f && data[1] === 0x8b
}

export async function decompressGzip(buffer: Uint8Array): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    gunzip(buffer, (error, decompressed) => {
      if (error) {
        reject(error)
      } else {
        resolve(decompressed)
      }
    })
  })
}

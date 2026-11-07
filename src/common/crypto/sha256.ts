import { toHex } from './toHex'

/**
 * Optimized SHA-256 module with lazy resource allocation.
 */

const STRING_BUFFER_SIZE = 65536

let K: Uint32Array | null = null
let W: Uint32Array | null = null
let STRING_BUFFER: Uint8Array | null = null
let TAIL_BUFFER: Uint8Array | null = null
let ENCODER: TextEncoder | null = null

/**
 * Lazily initializes SHA-256 constants and buffers.
 */
function ensureShaInit(): void {
  if (K) {
    return
  }

  K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
    0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
    0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
    0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
    0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
    0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ])

  W = new Uint32Array(64)
  ENCODER = new TextEncoder()
  STRING_BUFFER = new Uint8Array(STRING_BUFFER_SIZE)
  TAIL_BUFFER = new Uint8Array(128)
}

/**
 * Calculates SHA-256 and returns the raw hash as a Uint8Array (32 bytes).
 */
export function sha256Buffer(content: string | ArrayBufferView): Uint8Array
export function sha256Buffer(
  content: null | undefined | string | ArrayBufferView,
): Uint8Array | null
export function sha256Buffer(
  content: null | undefined | string | ArrayBufferView,
): Uint8Array | null {
  if (content == null) {
    return null
  }
  ensureShaInit()

  const k = K!
  const w = W!
  const tail = TAIL_BUFFER!

  let bytes: Uint8Array
  if (typeof content === 'string') {
    const encoder = ENCODER!
    // UTF-8 takes at most 3 bytes per UTF-16 code unit
    if (content.length * 3 <= STRING_BUFFER_SIZE) {
      const buffer = STRING_BUFFER!
      bytes = buffer.subarray(0, encoder.encodeInto(content, buffer).written)
    } else {
      bytes = encoder.encode(content)
    }
  } else if ((content as unknown) instanceof Uint8Array) {
    // Allocating a view for each call is noticeably slower on small inputs
    bytes = content as Uint8Array
  } else if (ArrayBuffer.isView(content)) {
    bytes = new Uint8Array(
      content.buffer,
      content.byteOffset,
      content.byteLength,
    )
  } else {
    throw new Error(
      `[sha256Buffer] Unsupported content type: ${typeof content}`,
    )
  }

  // Complete blocks are read directly from the input, so that hashing a large input
  // neither copies it nor keeps memory of its size after the call.
  // The remaining bytes and the padding, at most 2 blocks, go through the tail buffer
  const length = bytes.length
  const blocksEnd = length - (length % 64)
  const tailLength = length - blocksEnd
  const tailEnd = tailLength < 56 ? 64 : 128

  for (let i = 0; i < tailLength; i++) {
    tail[i] = bytes[blocksEnd + i]
  }

  // Padding
  tail[tailLength] = 0x80
  for (let i = tailLength + 1; i < tailEnd; i++) {
    tail[i] = 0
  }

  const bits = length * 8
  writeUint32BigEndian(tail, tailEnd - 8, (bits / 0x100000000) | 0)
  writeUint32BigEndian(tail, tailEnd - 4, bits | 0)

  let h0 = 0x6a09e667 | 0
  let h1 = 0xbb67ae85 | 0
  let h2 = 0x3c6ef372 | 0
  let h3 = 0xa54ff53a | 0
  let h4 = 0x510e527f | 0
  let h5 = 0x9b05688c | 0
  let h6 = 0x1f83d9ab | 0
  let h7 = 0x5be0cd19 | 0

  for (let part = 0; part < 2; part++) {
    const data = part === 0 ? bytes : tail
    const dataEnd = part === 0 ? blocksEnd : tailEnd
    for (let offset = 0; offset < dataEnd; offset += 64) {
      for (let i = 0; i < 16; i++) {
        const pos = offset + (i << 2)
        w[i] =
          (data[pos] << 24) |
          (data[pos + 1] << 16) |
          (data[pos + 2] << 8) |
          data[pos + 3]
      }
      for (let i = 16; i < 64; i++) {
        const v0 = w[i - 15]
        const v1 = w[i - 2]
        const s0 =
          ((v0 >>> 7) | (v0 << 25)) ^ ((v0 >>> 18) | (v0 << 14)) ^ (v0 >>> 3)
        const s1 =
          ((v1 >>> 17) | (v1 << 15)) ^ ((v1 >>> 19) | (v1 << 13)) ^ (v1 >>> 10)
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0
      }

      let a = h0
      let b = h1
      let c = h2
      let d = h3
      let e = h4
      let f = h5
      let g = h6
      let h = h7

      // Four rounds at a time instead of one loop of 64 rounds: measured about 10% faster
      // in Chromium and Firefox, equal in WebKit, about 15% slower in Node.js 22
      for (let i = 0; i < 64; i += 4) {
        for (let j = 0; j < 4; j++) {
          const idx = i + j
          const eS1 =
            ((e >>> 6) | (e << 26)) ^
            ((e >>> 11) | (e << 21)) ^
            ((e >>> 25) | (e << 7))
          const t1 = (h + eS1 + (g ^ (e & (f ^ g))) + k[idx] + w[idx]) | 0
          const aS0 =
            ((a >>> 2) | (a << 30)) ^
            ((a >>> 13) | (a << 19)) ^
            ((a >>> 22) | (a << 10))
          const t2 = (aS0 + ((a & b) ^ (c & (a ^ b)))) | 0
          h = g
          g = f
          f = e
          e = (d + t1) | 0
          d = c
          c = b
          b = a
          a = (t1 + t2) | 0
        }
      }

      h0 = (h0 + a) | 0
      h1 = (h1 + b) | 0
      h2 = (h2 + c) | 0
      h3 = (h3 + d) | 0
      h4 = (h4 + e) | 0
      h5 = (h5 + f) | 0
      h6 = (h6 + g) | 0
      h7 = (h7 + h) | 0
    }
  }

  const result = new Uint8Array(32)
  writeUint32BigEndian(result, 0, h0)
  writeUint32BigEndian(result, 4, h1)
  writeUint32BigEndian(result, 8, h2)
  writeUint32BigEndian(result, 12, h3)
  writeUint32BigEndian(result, 16, h4)
  writeUint32BigEndian(result, 20, h5)
  writeUint32BigEndian(result, 24, h6)
  writeUint32BigEndian(result, 28, h7)

  return result
}

function writeUint32BigEndian(
  bytes: Uint8Array,
  offset: number,
  word: number,
): void {
  bytes[offset] = word >>> 24
  bytes[offset + 1] = word >>> 16
  bytes[offset + 2] = word >>> 8
  bytes[offset + 3] = word
}

/**
 * Calculates SHA-256 and returns a Hex string.
 */
export function sha256(content: string | ArrayBufferView): string
export function sha256(
  content: null | undefined | string | ArrayBufferView,
): string | null
export function sha256(
  content: null | undefined | string | ArrayBufferView,
): string | null {
  const buffer = sha256Buffer(content)
  if (!buffer) {
    return null
  }

  return toHex(buffer)
}

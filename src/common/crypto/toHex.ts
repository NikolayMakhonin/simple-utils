/**
 * UNIVERSAL ZERO-COPY HEX ENGINE
 */

let BYTE_TO_HEX: string[] | null = null

/**
 * Lazy-initializes the lookup table only when needed.
 */
function getByteToHex(): string[] {
  if (!BYTE_TO_HEX) {
    BYTE_TO_HEX = new Array(256)
    for (let i = 0; i < 256; i++) {
      BYTE_TO_HEX[i] = i.toString(16).padStart(2, '0')
    }
  }
  return BYTE_TO_HEX
}

/**
 * Converts ANY TypedArray or DataView to a HEX string.
 * Uses a zero-copy Uint8 view of the underlying memory.
 */
export function toHex(data: ArrayBufferView): string {
  const tab = getByteToHex()
  const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
  let hex = ''
  for (let i = 0, len = bytes.length; i < len; i++) {
    hex += tab[bytes[i]]
  }
  return hex
}

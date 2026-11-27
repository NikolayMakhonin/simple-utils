let BYTE_TO_HEX: string[] | null = null

/**
 * Creates the lookup table at the first call, not at module level,
 * because package.json declares "sideEffects": false.
 */
function getByteToHex(): string[] {
  if (!BYTE_TO_HEX) {
    BYTE_TO_HEX = []
    for (let i = 0; i < 256; i++) {
      BYTE_TO_HEX[i] = i.toString(16).padStart(2, '0')
    }
  }
  return BYTE_TO_HEX
}

/**
 * Like buffer.toString('hex') of Node.js,
 * but for any ArrayBufferView and in browsers too.
 * Gives two lowercase hex digits per byte,
 * in the order of the bytes in memory.
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

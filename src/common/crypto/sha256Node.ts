import crypto from 'node:crypto'

export function sha256Node(data: string | Uint8Array | null | undefined) {
  if (data == null) {
    return null
  }
  return crypto.createHash('sha256').update(data).digest('hex')
}

export function sha256NodeBuffer(data: string | Uint8Array | null | undefined) {
  if (data == null) {
    return null
  }
  return crypto.createHash('sha256').update(data).digest()
}

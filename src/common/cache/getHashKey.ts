import { sha256 } from 'src/common/crypto'
import { getJsonKey } from './getJsonKey'

export function getHashKey(obj?: any): string {
  const json = getJsonKey(obj)
  return sha256(json)
}

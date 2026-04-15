import type { Converter } from '../../common'
import { pathNormalize } from '../fs'

export type CacheConverterSubPathOptions = {
  prefix?: null | string
  suffix?: null | string
  /**
   * Split key by dirs as normalized path with "/"
   * and without prepending and trailing slash.
   * For 2 letters the key "abcdef" will be "a/b/cdef"
   */
  splitKeyLetters?: null | number
}

export function createConverterSubPath(
  options: CacheConverterSubPathOptions,
): Converter<string, string, string, string | null> {
  const prefix = options.prefix ? pathNormalize(options.prefix) : ''
  const suffix = options.suffix ? pathNormalize(options.suffix) : ''
  const splitKeyLetters = options.splitKeyLetters ?? 0
  return {
    to(key: string): string {
      if (splitKeyLetters <= 0) {
        return pathNormalize(prefix + key + suffix)
      }
      const splitCount = Math.min(splitKeyLetters, key.length)
      let path = prefix
      for (let i = 0; i < splitCount; i++) {
        path += (i === 0 ? '' : '/') + key[i]
      }
      if (splitCount < key.length) {
        path += (splitCount === 0 ? '' : '/') + key.slice(splitCount)
      }
      return pathNormalize(path + suffix)
    },
    from(subPath: string): string | null {
      if (splitKeyLetters <= 0) {
        if (!subPath.startsWith(prefix)) {
          return null
        }
        if (!subPath.endsWith(suffix)) {
          return null
        }
        return subPath.slice(prefix.length, subPath.length - suffix.length)
      }
      if (!subPath.startsWith(prefix) || !subPath.endsWith(suffix)) {
        return null
      }
      return subPath
        .slice(prefix.length, subPath.length - suffix.length)
        .replace(/\//g, '')
    },
  }
}

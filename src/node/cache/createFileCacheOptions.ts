import {
  createConverterErrorToGzip,
  createConverterJsonGzip,
  type ConverterAsync,
  type ConvertToAsync,
} from 'src/common/converter'
import { getHashKey } from 'src/common/cache/getHashKey'
import { FileStorage } from './FileStorage'
import type { CacheOptions } from 'src/common/cache/Cache'
import { createConverterSubPath } from './createConverterSubPath'
import { FileStatStorage } from './FileStatStorage'
import type { CacheStat, NumberRange } from '../../common'
import type { CompressGzipOptions } from 'src/common/gzip/compressGzip'

export function createFileCacheOptions<Input, Value>(options: {
  dir: string
  /**
   * Temp dir should be on the same device as dir to be meaningful.
   * The temp dir can be shared between multiple cache instances
   */
  tmpDir: string
  totalSize?: null | NumberRange
  converterInput?: null | ConvertToAsync<Input, string>
  converterValue?: null | ConverterAsync<Value, Uint8Array>
  isExpired?: null | ((stat: CacheStat) => boolean)
  compressOptions?: null | CompressGzipOptions
}): CacheOptions<
  Input,
  Value,
  any,
  CacheStat,
  string,
  Uint8Array,
  Uint8Array,
  CacheStat
> {
  const storageValue = new FileStorage({
    dir: options.dir,
    tmpDir: options.tmpDir,
    converterSubPath: createConverterSubPath({ suffix: '.value' }),
  })
  const storageError = new FileStorage({
    dir: options.dir,
    tmpDir: options.tmpDir,
    converterSubPath: createConverterSubPath({ suffix: '.error' }),
  })
  const compressOptions = options.compressOptions ?? {
    level: 9,
  }
  return {
    converterInput: options.converterInput ?? getHashKey,
    converterValue:
      options.converterValue ?? createConverterJsonGzip(compressOptions),
    converterError: createConverterErrorToGzip(compressOptions),
    totalSize: options.totalSize,
    getSize: {
      value: value => value.byteLength,
      error: error => error.byteLength,
      stat: () => 0,
    },
    isExpired: options.isExpired,
    storages: {
      value: storageValue,
      error: storageError,
      stat: new FileStatStorage({
        storages: {
          value: storageValue,
          error: storageError,
        },
      }),
    },
  }
}

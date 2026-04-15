import type { ConverterAsync, ConvertToAsync } from 'src/common/converter'
import { converterErrorToBuffer } from 'src/common/converter/converterErrorToBuffer'
import { converterJsonBuffer } from 'src/common/converter/converterJsonBuffer'
import { getHashKey } from 'src/common/cache/getHashKey'
import { FileStorage } from './FileStorage'
import type { CacheOptions, CacheStat } from 'src/common/cache/Cache'
import { createConverterSubPath } from './createConverterSubPath'

export function createFileCacheOptions<Input, Value>(options: {
  dir: string
  /**
   * Temp dir should be on the same device as dir to be meaningful.
   * The temp dir can be shared between multiple cache instances
   */
  tmpDir: string
  converterInput?: null | ConvertToAsync<Input, string>
  converterValue?: null | ConverterAsync<Value, Uint8Array>
  isExpired?: null | ((stat: CacheStat) => boolean)
}): CacheOptions<
  Input,
  Value,
  any,
  CacheStat,
  string,
  Uint8Array,
  Uint8Array,
  Uint8Array
> {
  return {
    converterInput: options.converterInput ?? getHashKey,
    converterValue: options.converterValue ?? converterJsonBuffer,
    converterError: converterErrorToBuffer,
    converterStat: converterJsonBuffer,
    isExpired: options.isExpired,
    storages: {
      value: new FileStorage({
        dir: options.dir,
        tmpDir: options.tmpDir,
        converterSubPath: createConverterSubPath({ suffix: '.value' }),
      }),
      error: new FileStorage({
        dir: options.dir,
        tmpDir: options.tmpDir,
        converterSubPath: createConverterSubPath({ suffix: '.error' }),
      }),
      stat: new FileStorage({
        dir: options.dir,
        tmpDir: options.tmpDir,
        converterSubPath: createConverterSubPath({ suffix: '.stat' }),
      }),
    },
  }
}

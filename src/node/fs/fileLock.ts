import { poolRunWait } from 'src/common/async/pool/poolRunWait'
import { LockerWithId } from 'src/common/async/Locker'
import { poolFs } from './pools'
import { pathNormalize } from './pathNormalize'
import type { PromiseLikeOrValue } from 'src/common/types/common'

const fileLocker = new LockerWithId<string>()

export type FileLockOptions<Result> = {
  filePath: string
  func: () => PromiseLikeOrValue<Result>
}

/** Execute func with exclusive file access and limited parallel file operations */
export function fileLock<Result>(
  options: FileLockOptions<Result>,
): Promise<Result> {
  const { filePath, func } = options

  return fileLocker.lock(
    pathNormalize(filePath),
    () =>
      poolRunWait({
        pool: poolFs,
        count: 1,
        func,
      }) as any,
  ) as Promise<Result>
}

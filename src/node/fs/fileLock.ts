import { poolRunWait } from '@flemist/time-limits'
import { LockerWithId } from 'src/common/async/Locker'
import { poolFs } from './pools'
import { pathNormalize } from './pathNormalize'

const fileLocker = new LockerWithId<string>()

export type FileLockOptions<Result> = {
  filePath: string
  func: () => Promise<Result>
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

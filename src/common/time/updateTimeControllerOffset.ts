import type { PromiseLikeOrValue } from 'src/common/types/common'
import { isPromiseLike } from 'src/common/async/promise/isPromiseLike'
import {
  type TimeControllerDefault,
  timeControllerDefault,
} from 'src/common/time/time-controller'
import type { GetDateInetOptions } from './getDateInet'
import { getDateInetOffset } from './getDateInetOffset'

const STORAGE_KEY = 'timeControllerOffset'

/** Web Storage, such as localStorage, or its asynchronous counterpart */
export type TimeControllerOffsetStorage = {
  getItem(key: string): PromiseLikeOrValue<string | null>
  setItem(key: string, value: string): PromiseLikeOrValue<void>
}

export type UpdateTimeControllerOffsetOptions = GetDateInetOptions & {
  storage?: null | TimeControllerOffsetStorage
  timeController?: null | TimeControllerDefault
}

/**
 * Sets the offset of the time controller from the storage,
 * then from internet time, and saves the new offset to the storage.
 * With a synchronous storage, such as localStorage, it sets the stored offset
 * before it returns, so that the code that runs next reads the corrected time
 */
export async function updateTimeControllerOffset(
  options?: null | UpdateTimeControllerOffsetOptions,
): Promise<void> {
  const timeController = options?.timeController ?? timeControllerDefault
  const storage = options?.storage

  if (storage != null) {
    const valueOrPromise = storage.getItem(STORAGE_KEY)
    const value = isPromiseLike(valueOrPromise)
      ? await valueOrPromise
      : valueOrPromise
    if (value != null) {
      const offset = Number(value)
      if (!Number.isFinite(offset)) {
        throw new Error(
          `[updateTimeControllerOffset] stored offset (${value})` +
            ' is not a finite number',
        )
      }
      timeController.offset = offset
    }
  }

  const offset = await getDateInetOffset(options)
  timeController.offset = offset
  await storage?.setItem(STORAGE_KEY, String(offset))
}

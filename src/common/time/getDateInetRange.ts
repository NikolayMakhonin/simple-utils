import { type GetDateInetOptions, getDateInet } from './getDateInet'
import { DATE_JUMP_MINIMUM } from './date'
import { dateTimeReal } from './date-time'
import type { NumberRange } from 'src/common/types'

export type GetDateInetRangeOptions = GetDateInetOptions & {
  /**
   * Don't throw when Date.now() jumps forward by more than DATE_JUMP_MINIMUM during the request.
   * Widen the range by the jump instead. The range then still holds real time
   */
  dontThrow?: null | boolean
}

/**
 * Returns the range that holds real time at the moment of the return.
 * The range comes from the Date header of a web server response.
 * Throws when Date.now() jumps forward by more than DATE_JUMP_MINIMUM during the request, such as after a sleep
 */
export async function getDateInetRange(
  options?: null | GetDateInetRangeOptions,
): Promise<NumberRange> {
  const dateTime = options?.dateTime ?? dateTimeReal
  const timeStart = dateTime.time.time()
  const dateStart = Date.now()
  const dateInet = await getDateInet(options)
  const duration = dateTime.time.time() - timeStart
  const dateJump = Date.now() - dateStart - duration
  let durationMaximum = duration
  if (dateJump > DATE_JUMP_MINIMUM) {
    if (!options?.dontThrow) {
      throw new Error(
        `[getDateInetRange] Date.now() got ahead of dateTime.time.time() by ${dateJump} ms during the request, so dateTime.time.time() may have missed a sleep`,
      )
    }
    // A sleep that dateTime.time.time() missed makes the request as long as Date.now() counted it
    durationMaximum += dateJump
  }
  // The server truncates the Date header to whole seconds.
  // It sets the header between the request and the response.
  // So at the response, real time lies between dateInet and dateInet + 1 second + the longest duration of the request
  return [dateInet, dateInet + 1000 + durationMaximum]
}

import { type GetDateInetOptions, getDateInet } from './getDateInet'
import { DATE_JUMP_MINIMUM } from './now'
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
  const performanceStart = performance.now()
  const dateStart = Date.now()
  const date = await getDateInet(options)
  const duration = performance.now() - performanceStart
  const dateJump = Date.now() - dateStart - duration
  let durationMaximum = duration
  if (dateJump > DATE_JUMP_MINIMUM) {
    if (!options?.dontThrow) {
      throw new Error(
        `[getDateInetRange] Date.now() got ahead of performance.now() by ${dateJump} ms during the request, so performance.now() may have missed a sleep`,
      )
    }
    // A sleep that performance.now() missed makes the request as long as Date.now() counted it
    durationMaximum += dateJump
  }
  // The server truncates the Date header to whole seconds and sets it
  // between the request and the response, so real time at the response
  // lies between date and date + 1 second + the longest duration of the request
  return [date, date + 1000 + durationMaximum]
}

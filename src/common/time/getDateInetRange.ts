import { type GetDateInetOptions, getDateInet } from './getDateInet'
import { DATE_JUMP_MINIMUM } from './clock-date'
import { clockReal } from './clock'
import type { NumberRange } from 'src/common/types'

export type GetDateInetRangeOptions = GetDateInetOptions & {
  /**
   * Don't throw when Date.now() jumps forward by more than DATE_JUMP_MINIMUM during the request.
   * Widen the range by the jump instead. The range then still holds real time
   */
  dontThrow?: null | boolean
}

/**
 * Returns the range that holds real time at the moment of the return, in whole milliseconds.
 * The range comes from the Date header of a web server response.
 * Throws when Date.now() jumps forward by more than DATE_JUMP_MINIMUM during the request, such as after a sleep
 */
export async function getDateInetRange(
  options?: null | GetDateInetRangeOptions,
): Promise<NumberRange> {
  const clock = options?.clock ?? clockReal
  const timeStart = clock.time.value()
  const dateStart = Date.now()
  const dateInet = await getDateInet(options)
  const duration = clock.time.value() - timeStart
  const dateJump = Date.now() - dateStart - duration
  let durationMaximum = duration
  if (dateJump > DATE_JUMP_MINIMUM) {
    if (!options?.dontThrow) {
      throw new Error(
        `[getDateInetRange] Date.now() got ahead of clock.time.value() by ${dateJump} ms during the request, so clock.time.value() may have missed a sleep`,
      )
    }
    // A sleep that clock.time.value() missed makes the request as long as Date.now() counted it
    durationMaximum += dateJump
  }
  // The server truncates the Date header to whole seconds.
  // It sets the header between the request and the response.
  // So at the response, real time lies between dateInet and dateInet + 1 second + the longest duration of the request
  return [dateInet, dateInet + 1000 + Math.ceil(durationMaximum)]
}

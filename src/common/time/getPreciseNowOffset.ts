import { type GetDateInetOptions, getDateInet } from './getDateInet'

/**
 * Returns the milliseconds to add to Date.now() to get internet time,
 * with an error of up to half of 1 second plus the request time
 */
export async function getPreciseNowOffset(
  options?: null | GetDateInetOptions,
): Promise<number> {
  const start = Date.now()
  const date = await getDateInet(options)
  const end = Date.now()
  // The server truncates the Date header to whole seconds and sets it
  // between the request and the response, so the offset lies
  // between date - end and date + 1000 - start.
  // The middle of this range halves the largest error
  return Math.round(date + 500 - (start + end) / 2)
}

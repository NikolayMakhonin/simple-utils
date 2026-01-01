/** Default time zone is Local */
export function convertTimeZone(
  date: Date,
  timeZoneFrom?: null | string,
  timeZoneTo?: null | string,
): Date {
  const dateFrom =
    timeZoneFrom == null
      ? date
      : new Date(
        date.toLocaleString('en-US', {
          timeZone: timeZoneFrom,
        }),
      )

  const dateTo =
    timeZoneTo == null
      ? date
      : new Date(
        date.toLocaleString('en-US', {
          timeZone: timeZoneTo,
        }),
      )

  const result = new Date(
    date.getTime() + dateTo.getTime() - dateFrom.getTime(),
  )

  return result
}

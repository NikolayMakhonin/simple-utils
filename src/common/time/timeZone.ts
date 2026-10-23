/** Default time zone is Local */
export function convertTimeZone(
  date: Date,
  timeZoneFrom?: null | string,
  timeZoneTo?: null | string,
): Date {
  const time = date.getTime()
  // The zone offset is measured without milliseconds on both sides,
  // because toLocaleString drops them
  const timeLocal = time - date.getUTCMilliseconds()

  const timeFrom =
    timeZoneFrom == null
      ? timeLocal
      : new Date(
          date.toLocaleString('en-US', {
            timeZone: timeZoneFrom,
          }),
        ).getTime()

  const timeTo =
    timeZoneTo == null
      ? timeLocal
      : new Date(
          date.toLocaleString('en-US', {
            timeZone: timeZoneTo,
          }),
        ).getTime()

  return new Date(time + timeTo - timeFrom)
}

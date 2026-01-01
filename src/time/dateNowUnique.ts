let prevDate: number | null = null

/**
 * Returns a Date.now() value, but if it <= previous date,
 * increments it by 1 millisecond to ensure uniqueness
 */
export function dateNowUnique(): number {
  const date = Date.now()

  if (prevDate == null || date > prevDate) {
    prevDate = date
    return date
  }

  prevDate++
  return prevDate
}

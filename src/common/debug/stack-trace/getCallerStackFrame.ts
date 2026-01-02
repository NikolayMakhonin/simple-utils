// export function getCallerStackFrame(): string | undefined | null {
//   const stack = new Error().stack
//   const match = stack?.match(
//     /(?:(?:^|[\r\n]+)[ \t]*at .*){2}(?:^|[\r\n]+)(^[ \t]*at .*)(?:(?:^|[\r\n]+)[ \t]*at .*)*\s*$/m,
//   )
//   return match?.[1]
// }

// TODO: write doc comments
/** @deprecated Пока не ясно нужно ли это */
export function getCallerStackFrame(): string | undefined | null {
  const stack = new Error().stack
  if (!stack) {
    return null
  }
  let indexStart = stack.indexOf('\n')
  if (indexStart < 0) {
    return null
  }
  indexStart = stack.indexOf('\n', indexStart + 1)
  if (indexStart < 0) {
    return null
  }
  indexStart = stack.indexOf('\n', indexStart + 1)
  if (indexStart < 0) {
    return null
  }
  indexStart += 1
  const indexEnd = stack.indexOf('\n', indexStart)
  if (indexEnd < 0) {
    return null
  }
  return stack.slice(indexStart, indexEnd)
}

// TODO: write doc comment
export function getStackTrace(): string {
  let stack = new Error().stack
  if (stack != null) {
    const index = stack.indexOf('\n')
    if (index != null && index >= 0) {
      stack = stack.substring(index + 1)
    }
  }
  return stack ?? ''
}

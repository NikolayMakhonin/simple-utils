export function escapeRegExp(text: null | undefined): null
export function escapeRegExp(text: string): string
export function escapeRegExp(
  text: string | null | undefined,
): string | null | undefined {
  if (text == null) {
    return null
  }
  return text?.replace(/[/\\^$*+?.()|[\]{}]/g, '\\$&')
}

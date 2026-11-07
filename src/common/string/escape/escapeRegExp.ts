export function escapeRegExp(text: string): string
export function escapeRegExp(text: string | null | undefined): string | null
export function escapeRegExp(text: string | null | undefined): string | null {
  if (text == null) {
    return null
  }
  return text.replace(/[/\\^$*+?.()|[\]{}]/g, '\\$&')
}

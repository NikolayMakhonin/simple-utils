// from: https://stackoverflow.com/a/28458409/5221762
export function escapeHtml(text: null | undefined): null
export function escapeHtml(text: string): string
export function escapeHtml(
  text: string | null | undefined,
): string | null | undefined {
  if (text == null) {
    return null
  }
  return text.replace(/[&<>"']/g, m => {
    switch (m) {
      case '&':
        return '&amp;'
      case '<':
        return '&lt;'
      case '>':
        return '&rt;'
      case '"':
        return '&quot;'
      default:
        return '&#039;'
    }
  })
}

// from: https://stackoverflow.com/a/28458409/5221762
export function escapeHtml(text: string): string
export function escapeHtml(text: string | null | undefined): string | null
export function escapeHtml(text: string | null | undefined): string | null {
  if (text == null) {
    return null
  }
  return text.replace(/[&<>"']/g, escapeHtmlChar)
}

function escapeHtmlChar(char: string): string {
  switch (char) {
    case '&':
      return '&amp;'
    case '<':
      return '&lt;'
    case '>':
      return '&gt;'
    case '"':
      return '&quot;'
    default:
      return '&#039;'
  }
}

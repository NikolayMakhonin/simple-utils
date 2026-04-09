import {
  formatAny,
  type FormatAnyOptions,
} from 'src/common/string/format/formatAny'
import { Matcher, type MatcherArgs } from './Matcher'

function formatObject(obj: any, options?: null | FormatAnyOptions): string {
  return formatAny(obj, {
    maxDepth: 1,
    maxItems: 5,
    ...options,
  })
}

export function isMatcher(value: any): value is Matcher<any> {
  return value instanceof Matcher
}

export function expectedToString(expected: any): string {
  return formatObject(expected)
}

export function argsToString(
  args: MatcherArgs<any> | null | undefined,
  ...excludeKeys: string[]
): string {
  if (args == null) {
    return ''
  }
  const result = formatObject(args, {
    filter: (path, value) => {
      if (path.length === 0) {
        return true
      }
      if (path.length !== 1) {
        return false
      }
      const key = path[0]
      if (key === 'name' || key === 'expected') {
        return false
      }
      if (value == null || value === false) {
        return false
      }
      if (excludeKeys.includes(key)) {
        return false
      }
      return true
    },
  })
  if (/^(#\d+\s*)\{}$/.test(result)) {
    return ''
  }
  return `(${result})`
}

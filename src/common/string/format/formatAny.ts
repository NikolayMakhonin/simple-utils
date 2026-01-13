// noinspection JSUnfilteredForInLoop

import { formatDate } from './formatDate'
import { getObjectId } from './getObjectId'

function tryGetValue(obj: any, key: string | number): any {
  try {
    return obj[key]
  } catch (err) {
    return 'Error: ' + (err instanceof Error ? err.message : String(err))
  }
}

export type FormatAnyOptions = {
  pretty?: boolean
  filter?: null | ((path: string[], value: any) => boolean)
  maxDepth?: number
  maxItems?: number
  showObjectId?: boolean
  showArrayIndex?: boolean
  customToString?:
    | null
    | ((
        obj: any,
        toString: (obj: any) => any,
      ) => string | null | undefined | void)
}

export function formatAny(
  obj: any,
  options?: null | FormatAnyOptions,
  path?: null | string[],
  visited?: null | Set<any>,
): string {
  const {
    pretty,
    filter,
    maxDepth,
    maxItems,
    showObjectId,
    showArrayIndex,
    customToString,
  } = options ?? {}
  if (path == null) {
    path = []
  }
  if (visited == null) {
    visited = new Set()
  }

  if (customToString) {
    const str = customToString(obj, o => formatAny(o, options, path, visited))
    if (str != null) {
      return str
    }
  }

  const depth = path.length

  if (typeof obj === 'string') {
    return JSON.stringify(obj)
  }

  if (obj == null || typeof obj !== 'object') {
    return String(obj)
  }

  if (obj instanceof ArrayBuffer || ArrayBuffer.isView(obj)) {
    return `${obj.constructor?.name ?? ''}#${getObjectId(obj)}[${obj.byteLength}]`
  }

  if (obj instanceof RegExp) {
    return String(obj)
  }

  if (obj instanceof Date) {
    return formatDate(obj)
  }

  if (obj instanceof Object) {
    if (visited.has(obj) || (maxDepth != null && depth >= maxDepth)) {
      const name =
        obj.constructor === Object ? '' : (obj.constructor?.name ?? '')
      return `${name}#${getObjectId(obj)}`
    } else {
      visited.add(obj)
    }
  }

  if (obj instanceof Error) {
    return obj.stack || obj.message || String(obj)
  }

  if (Array.isArray(obj)) {
    const indent = pretty ? '  '.repeat(depth) : ''
    let result = ''
    if (showObjectId) {
      result += `#${getObjectId(obj)} `
    }
    result += '['
    let outputCount = 0
    let truncated = false
    for (let i = 0; i < obj.length; i++) {
      if (maxItems != null && outputCount >= maxItems) {
        truncated = true
        break
      }
      const pathNext = [...path, String(i)]
      const value = tryGetValue(obj, i)
      if (filter != null && !filter(pathNext, value)) {
        continue
      }
      const valueStr = formatAny(value, options, pathNext, visited)
      if (outputCount > 0) {
        result += ','
        if (pretty) {
          result += '\n'
        }
      } else if (pretty) {
        result += '\n'
      }
      if (pretty) {
        result += `${indent}  `
      }
      if (showArrayIndex) {
        result += `${i}: `
      }
      result += `${valueStr}`
      outputCount++
    }
    if (truncated) {
      if (outputCount > 0) {
        result += ','
      }
      if (pretty) {
        result += '\n'
        result += `${indent}  ...\n`
      } else {
        result += '...'
      }
      result += indent
      result += ']'
    } else {
      if (outputCount > 0 && pretty) {
        result += `\n${indent}`
      }
      result += ']'
    }
    return result
  }

  if (obj instanceof Map) {
    let result = ''
    if (showObjectId) {
      result += `#${getObjectId(obj)} `
    }
    result += 'Map'
    result += formatAny(Array.from(obj.entries()), options, path, visited)
    return result
  }

  if (obj instanceof Set) {
    let result = ''
    if (showObjectId) {
      result += `#${getObjectId(obj)} `
    }
    result += 'Set'
    result += formatAny(Array.from(obj.values()), options, path, visited)
    return result
  }

  // object
  {
    const name = obj.constructor === Object ? '' : (obj.constructor?.name ?? '')
    const indent = pretty ? '  '.repeat(depth) : ''
    let result = name ? `${name} ` : ''
    if (showObjectId) {
      result += `#${getObjectId(obj)} `
    }
    result += '{'
    let i = 0
    let truncated = false

    for (const key in obj) {
      if (maxItems != null && i >= maxItems) {
        truncated = true
        break
      }
      const pathNext = [...path, key]
      const value = tryGetValue(obj, key)
      if (filter != null && !filter(pathNext, value)) {
        continue
      }
      const valueStr = formatAny(value, options, pathNext, visited)
      if (i > 0) {
        result += ','
        if (pretty) {
          result += '\n'
        }
      } else if (pretty) {
        result += '\n'
      }
      if (pretty) {
        result += `${indent}  `
      }
      result += `${key}: ${valueStr}`
      i++
    }
    if (truncated) {
      if (i > 0) {
        result += ','
      }
      if (pretty) {
        result += '\n'
        result += `${indent}  ...\n`
      } else {
        result += '...'
      }
      result += indent
    }
    if (i > 0 && pretty && !truncated) {
      result += `\n${indent}`
    }
    result += '}'
    return result
  }
}

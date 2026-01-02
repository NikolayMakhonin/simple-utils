// noinspection JSUnfilteredForInLoop

import { getObjectId } from './getObjectId'

function tryGetValue(obj: any, key: string): any {
  try {
    return obj[key]
  } catch (err) {
    return 'Error: ' + (err?.message || String(err))
  }
}

export function formatAny(
  obj: any,
  options: {
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
  } = {},
  path: string[] = [],
  visited: Set<any> = new Set(),
): string {
  const {
    pretty,
    filter,
    maxDepth,
    maxItems,
    showObjectId,
    showArrayIndex,
    customToString,
  } = options

  if (customToString) {
    const str = customToString(obj, o => formatAny(o, options, path, visited))
    if (str != null) {
      return str as any
    }
  }

  const depth = path.length

  if (typeof obj === 'string') {
    return JSON.stringify(obj)
  }

  if (obj == null || typeof obj !== 'object') {
    return String(obj)
  }

  if (typeof obj.byteLength === 'number') {
    return `${obj.constructor.name}#${getObjectId(obj)}[${obj.byteLength}]`
  }

  if (obj instanceof RegExp) {
    return String(obj)
  }

  if (Array.isArray(obj)) {
    if (visited.has(obj) || (maxDepth != null && depth >= maxDepth)) {
      return `#${getObjectId(obj)}`
    }
    const indent = pretty ? '  '.repeat(depth) : ''
    let result = ''
    if (showObjectId) {
      result += `#${getObjectId(obj)} `
    }
    result += '['
    const len = maxItems != null ? Math.min(obj.length, maxItems) : obj.length
    if (len > 0 && pretty) {
      result += '\n'
    }
    for (let i = 0; i < len; i++) {
      const pathNext = [...path, String(i)]
      if (filter != null && !filter(pathNext, obj[i])) {
        continue
      }
      const value = obj[i]
      const valueStr = formatAny(value, options, pathNext)
      if (i > 0) {
        result += ','
        if (pretty) {
          result += '\n'
        }
      }
      if (pretty) {
        result += `${indent}  `
      }
      if (showArrayIndex) {
        result += `${i}: `
      }
      result += `${valueStr}`
    }
    if (len > 0 && pretty) {
      result += '\n'
    }
    if (obj.length > len) {
      if (len > 0) {
        result += ','
      }
      result += pretty ? `${indent}  ...\n` : '...'
    }
    if (len > 0 && pretty) {
      result += indent
    }
    result += ']'
    return result
  }

  if (obj instanceof Map) {
    if (visited.has(obj) || (maxDepth != null && depth >= maxDepth)) {
      return `#${getObjectId(obj)}`
    }
    let result = ''
    if (showObjectId) {
      result += `#${getObjectId(obj)} `
    }
    result += 'Map'
    result += formatAny(Array.from(obj.entries()), options, path, visited)
    return result
  }

  if (obj instanceof Set) {
    if (visited.has(obj) || (maxDepth != null && depth >= maxDepth)) {
      return `#${getObjectId(obj)}`
    }
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
    const name =
      obj.prototype?.constructor === Object
        ? ''
        : obj.prototype?.constructor.name
    if (visited.has(obj) || (maxDepth != null && depth >= maxDepth)) {
      return `${name}#${getObjectId(obj)}`
    }
    const indent = pretty ? '  '.repeat(depth) : ''
    let result = name ? `${name} ` : ''
    if (showObjectId) {
      result += `#${getObjectId(obj)} `
    }
    result += '{'
    const len = maxItems != null ? Math.min(obj.length, maxItems) : obj.length
    let i = 0

    for (const key in obj) {
      if (i === 0 && pretty) {
        result += '\n'
      }
      if (i >= len) {
        if (i > 0) {
          result += ','
        }
        result += pretty ? `${indent}  ...\n` : '...'
        break
      }
      const pathNext = [...path, key]
      if (filter != null && !filter(pathNext, obj[key])) {
        continue
      }
      const value = tryGetValue(obj, key)
      const valueStr = formatAny(value, options, pathNext)
      if (i > 0) {
        result += ','
        if (pretty) {
          result += '\n'
        }
      }
      if (pretty) {
        result += `${indent}  `
      }
      result += `${key}: ${valueStr}`
      i++
    }
    if (i > 0 && pretty) {
      result += `\n${indent}`
    }
    result += '}'
    return result
  }
}

// noinspection JSUnfilteredForInLoop

import { formatDate } from './formatDate'
import { getObjectId } from './getObjectId'
import { truncateString, type TruncateStringOptions } from './truncateString'
import { isPlainObject } from 'src/common/object/isPlainObject'

function tryGetValue(obj: any, key: string | number): any {
  try {
    return obj[key]
  } catch (err) {
    return 'Error: ' + (err instanceof Error ? err.message : String(err))
  }
}

export type FormatAnyToString = (
  obj: any,
  path: string[],
  toString: (obj: any) => any,
) => string | null | undefined | void

export type FormatAnyOptions = {
  pretty?: null | boolean
  filter?: null | ((path: string[], value: any) => boolean)
  maxDepth?: null | number
  maxItems?: null | number
  maxStringLength?: null | number
  showObjectId?: null | boolean
  showArrayIndex?: null | boolean
  dontExpandClassInstances?: null | boolean
  dontExpandFunctions?: null | boolean
  customToString?: null | FormatAnyToString
  truncateOptions?: null | TruncateStringOptions
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
    maxStringLength,
    showObjectId,
    showArrayIndex,
    dontExpandClassInstances,
    dontExpandFunctions,
    customToString,
  } = options ?? {}
  if (path == null) {
    path = []
  }
  if (visited == null) {
    visited = new Set()
  }

  if (customToString) {
    const str = customToString(obj, path, o =>
      formatAny(o, options, path, visited),
    )
    if (str != null) {
      return truncateString(str, maxStringLength, options?.truncateOptions)
    }
  }

  const depth = path.length

  if (typeof obj === 'string') {
    obj = truncateString(obj, maxStringLength, options?.truncateOptions)
    if (visited.size > 0) {
      // JSON.stringify inside objects only
      obj = JSON.stringify(obj)
    }
    return obj
  }

  if (obj == null || typeof obj !== 'object') {
    if (typeof obj === 'function') {
      if (dontExpandFunctions) {
        const name = obj.name || 'anonymous'
        if (showObjectId) {
          return `function ${name}#${getObjectId(obj)}`
        }
        return `function ${name}`
      }
      return indentLines(
        truncateString(String(obj), maxStringLength, options?.truncateOptions),
        pretty,
        depth,
      )
    }
    if (typeof obj === 'bigint') {
      return `${obj}n`
    }
    return String(obj)
  }

  if (obj instanceof ArrayBuffer || ArrayBuffer.isView(obj)) {
    const name = obj.constructor?.name ?? ''
    if (showObjectId) {
      return `${name}#${getObjectId(obj)}[${obj.byteLength}]`
    }
    return `${name}[${obj.byteLength}]`
  }

  if (obj instanceof RegExp) {
    return truncateString(
      String(obj),
      maxStringLength,
      options?.truncateOptions,
    )
  }

  if (obj instanceof Date) {
    return formatDate(obj)
  }

  if (obj instanceof Error) {
    return indentLines(
      truncateString(
        obj.stack || obj.message || String(obj),
        maxStringLength,
        options?.truncateOptions,
      ),
      pretty,
      depth,
    )
  }

  if (visited.has(obj)) {
    const name = obj.constructor === Object ? '' : (obj.constructor?.name ?? '')
    return `${name}#${getObjectId(obj)}`
  }
  if (maxDepth != null && depth >= maxDepth) {
    const name = obj.constructor === Object ? '' : (obj.constructor?.name ?? '')
    if (showObjectId) {
      return `${name}#${getObjectId(obj)}`
    }
    return name || 'Object'
  } else {
    visited.add(obj)
  }

  if (Array.isArray(obj)) {
    const items: string[] = []
    let truncated = false
    for (let i = 0, len = obj.length; i < len; i++) {
      const pathNext = [...path, String(i)]
      const value = tryGetValue(obj, i)
      if (filter != null && !filter(pathNext, value)) {
        continue
      }
      if (maxItems != null && items.length >= maxItems) {
        truncated = true
        break
      }
      const valueStr = formatAny(value, options, pathNext, visited)
      items.push(showArrayIndex ? `${i}: ${valueStr}` : valueStr)
    }
    return formatItems(
      getPrefix(obj, '', showObjectId) + '[',
      ']',
      items,
      truncated,
      pretty,
      depth,
    )
  }

  if (obj instanceof Map) {
    const items: string[] = []
    let truncated = false
    let index = 0
    for (const [key, value] of obj) {
      const pathNext = [...path, String(index++)]
      if (filter != null && !filter(pathNext, value)) {
        continue
      }
      if (maxItems != null && items.length >= maxItems) {
        truncated = true
        break
      }
      const keyStr = formatAny(key, options, pathNext, visited)
      const valueStr = formatAny(value, options, pathNext, visited)
      items.push(`[${keyStr}, ${valueStr}]`)
    }
    return formatItems(
      getPrefix(obj, 'Map', showObjectId) + '[',
      ']',
      items,
      truncated,
      pretty,
      depth,
    )
  }

  if (obj instanceof Set) {
    const items: string[] = []
    let truncated = false
    let index = 0
    for (const value of obj) {
      const pathNext = [...path, String(index++)]
      if (filter != null && !filter(pathNext, value)) {
        continue
      }
      if (maxItems != null && items.length >= maxItems) {
        truncated = true
        break
      }
      items.push(formatAny(value, options, pathNext, visited))
    }
    return formatItems(
      getPrefix(obj, 'Set', showObjectId) + '[',
      ']',
      items,
      truncated,
      pretty,
      depth,
    )
  }

  if (dontExpandClassInstances && !isPlainObject(obj)) {
    const name = obj.constructor?.name ?? ''
    if (showObjectId) {
      return `${name}#${getObjectId(obj)}`
    }
    return name || 'Object'
  }

  // object
  const items: string[] = []
  let truncated = false
  for (const key in obj) {
    const pathNext = [...path, key]
    const value = tryGetValue(obj, key)
    if (filter != null && !filter(pathNext, value)) {
      continue
    }
    if (maxItems != null && items.length >= maxItems) {
      truncated = true
      break
    }
    items.push(`${key}: ${formatAny(value, options, pathNext, visited)}`)
  }
  const name = obj.constructor === Object ? '' : (obj.constructor?.name ?? '')
  return formatItems(
    getPrefix(obj, name, showObjectId) + '{',
    '}',
    items,
    truncated,
    pretty,
    depth,
  )
}

/** `Name#id ` with the object id when showObjectId is set, `Name ` otherwise */
function getPrefix(
  obj: object,
  name: string,
  showObjectId: null | undefined | boolean,
): string {
  if (showObjectId) {
    return `${name}#${getObjectId(obj)} `
  }
  return name ? `${name} ` : ''
}

/** Joins formatted items: on one line, or one item per line indented by depth when pretty */
function formatItems(
  start: string,
  end: string,
  items: string[],
  truncated: boolean,
  pretty: null | undefined | boolean,
  depth: number,
): string {
  if (truncated) {
    items.push('...')
  }
  if (items.length === 0) {
    return start + end
  }
  if (!pretty) {
    return start + items.join(', ') + end
  }
  const indent = '  '.repeat(depth)
  return `${start}\n${indent}  ${items.join(`,\n${indent}  `)}\n${indent}${end}`
}

/** Indents the lines after the first one, so that a multi-line value stays under its key when pretty */
function indentLines(
  str: string,
  pretty: null | undefined | boolean,
  depth: number,
): string {
  if (!pretty || depth === 0) {
    return str
  }
  return str.replace(/\n/g, `\n${'  '.repeat(depth)}`)
}

// noinspection JSUnfilteredForInLoop

import { formatDate } from './formatDate'
import { getObjectId } from './getObjectId'
import { truncateString, type TruncateStringOptions } from './truncateString'
import { isPlainObject } from 'src/common/object/isPlainObject'

// Error properties that hold the underlying errors: cause, and errors of AggregateError.
// Errors create them not enumerable, so for...in skips them.
// E.g. Node.js fetch throws "fetch failed" with the network error in cause
const ERROR_HIDDEN_KEYS = ['cause', 'errors']

function tryGetValue(obj: any, key: string | number): any {
  try {
    return obj[key]
  } catch (err) {
    return 'Error: ' + (err instanceof Error ? err.message : String(err))
  }
}

/**
 * @param path Keys from the root value to obj (property names, array indexes, Map and Set
 * entry indexes). formatAny reuses this array, so copy it to keep it after the call
 */
export type FormatAnyToString = (
  obj: any,
  path: string[],
  toString: (obj: any) => any,
) => string | null | undefined | void

export type FormatAnyOptions = {
  pretty?: null | boolean
  /**
   * The path argument holds the keys from the root value to value (property names,
   * array indexes, Map and Set entry indexes). formatAny reuses this array,
   * so copy it to keep it after the call
   */
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

export function formatAny(obj: any, options?: null | FormatAnyOptions): string {
  // Fast path for a primitive value or a function.
  // formatAnyWithState creates its inner functions on every call.
  // For a number or a string, that makes formatting 2-3 times slower
  // in Node.js, Chromium and Firefox
  if ((obj == null || typeof obj !== 'object') && !options?.customToString) {
    return formatNotObject(obj, options, 0, false)
  }
  return formatAnyWithState(obj, options)
}

function formatAnyWithState(
  obj: any,
  options: null | undefined | FormatAnyOptions,
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
    customToString,
    truncateOptions,
  } = options ?? {}
  // These sets stay null until first needed, so that values that do not need them
  // allocate nothing. A Date needs no visited, most objects need no repeated
  let visited: Set<any> | null = null
  let repeated: Set<any> | null = null
  let idsShown: Set<any> | null = null
  // One array reused for all values, instead of a new array per value.
  // Null when neither filter nor customToString reads it
  const path: string[] | null =
    filter != null || customToString != null ? [] : null

  function isIdShown(obj: any): boolean {
    return !!showObjectId || (idsShown != null && idsShown.has(obj))
  }

  function format(obj: any, depth: number): string {
    if (customToString) {
      const str = customToString(obj, path!, o => format(o, depth))
      if (str != null) {
        return truncateString(str, maxStringLength, truncateOptions)
      }
    }

    if (obj == null || typeof obj !== 'object') {
      return formatNotObject(obj, options, depth, visited != null)
    }

    if (obj instanceof ArrayBuffer || ArrayBuffer.isView(obj)) {
      const name = getClassName(obj)
      if (showObjectId) {
        return `${name}#${getObjectId(obj)}[${obj.byteLength}]`
      }
      return `${name}[${obj.byteLength}]`
    }

    if (obj instanceof RegExp) {
      return truncateString(String(obj), maxStringLength, truncateOptions)
    }

    if (obj instanceof Date) {
      // For a negative year formatDate throws, but formatAny must format any value
      return obj.getFullYear() < 0 ? obj.toISOString() : formatDate(obj)
    }

    const isError = obj instanceof Error

    if (visited != null && visited.has(obj)) {
      if (repeated == null) {
        repeated = new Set()
      }
      repeated.add(obj)
      return `${getClassName(obj)}#${getObjectId(obj)}`
    }
    if (!isError && maxDepth != null && depth >= maxDepth) {
      const name = getClassName(obj)
      if (isIdShown(obj)) {
        return `${name}#${getObjectId(obj)}`
      }
      return name || 'Object'
    }
    if (visited == null) {
      visited = new Set()
    }
    visited.add(obj)

    if (isError) {
      return formatError(obj, depth)
    }

    if (Array.isArray(obj)) {
      const items: string[] = []
      let truncated = false
      for (let i = 0, len = obj.length; i < len; i++) {
        if (path != null) {
          path[depth] = String(i)
        }
        const value = tryGetValue(obj, i)
        if (filter != null && !filter(path!, value)) {
          continue
        }
        if (maxItems != null && items.length >= maxItems) {
          truncated = true
          break
        }
        const valueStr = format(value, depth + 1)
        items.push(showArrayIndex ? `${i}: ${valueStr}` : valueStr)
      }
      return formatItems(
        getPrefix(obj, '', isIdShown(obj)) + '[',
        ']',
        items,
        truncated,
        depth,
      )
    }

    if (obj instanceof Map) {
      const items: string[] = []
      let truncated = false
      let index = 0
      for (const [key, value] of obj) {
        if (path != null) {
          path[depth] = String(index++)
        }
        if (filter != null && !filter(path!, value)) {
          continue
        }
        if (maxItems != null && items.length >= maxItems) {
          truncated = true
          break
        }
        const keyStr = format(key, depth + 1)
        const valueStr = format(value, depth + 1)
        items.push(`[${keyStr}, ${valueStr}]`)
      }
      return formatItems(
        getPrefix(obj, 'Map', isIdShown(obj)) + '[',
        ']',
        items,
        truncated,
        depth,
      )
    }

    if (obj instanceof Set) {
      const items: string[] = []
      let truncated = false
      let index = 0
      for (const value of obj) {
        if (path != null) {
          path[depth] = String(index++)
        }
        if (filter != null && !filter(path!, value)) {
          continue
        }
        if (maxItems != null && items.length >= maxItems) {
          truncated = true
          break
        }
        items.push(format(value, depth + 1))
      }
      return formatItems(
        getPrefix(obj, 'Set', isIdShown(obj)) + '[',
        ']',
        items,
        truncated,
        depth,
      )
    }

    if (dontExpandClassInstances && !isPlainObject(obj)) {
      const name = getClassName(obj)
      if (isIdShown(obj)) {
        return `${name}#${getObjectId(obj)}`
      }
      return name || 'Object'
    }

    // object
    const items: string[] = []
    let truncated = false
    for (const key in obj) {
      if (!addProperty(obj, key, items, depth)) {
        truncated = true
        break
      }
    }
    const name = getClassName(obj)
    return formatItems(
      getPrefix(obj, name, isIdShown(obj)) + '{',
      '}',
      items,
      truncated,
      depth,
    )
  }

  /**
   * Adds `key: value` to items, unless filter rejects it.
   * Returns false when items already has maxItems items
   */
  function addProperty(
    obj: any,
    key: string,
    items: string[],
    depth: number,
  ): boolean {
    if (path != null) {
      path[depth] = key
    }
    const value = tryGetValue(obj, key)
    if (filter != null && !filter(path!, value)) {
      return true
    }
    if (maxItems != null && items.length >= maxItems) {
      return false
    }
    items.push(`${key}: ${format(value, depth + 1)}`)
    return true
  }

  /**
   * The error text (name, message and stack),
   * followed by the other properties of the error, e.g. code, cause
   */
  function formatError(error: any, depth: number): string {
    let text = indentLines(
      truncateString(getErrorText(error), maxStringLength, truncateOptions),
      pretty,
      depth,
    )
    if (isIdShown(error)) {
      text = `${getClassName(error)}#${getObjectId(error)} ${text}`
    }
    if (dontExpandClassInstances || (maxDepth != null && depth >= maxDepth)) {
      return text
    }

    const items: string[] = []
    let truncated = false
    for (const key in error) {
      if (
        key !== 'name' &&
        key !== 'message' &&
        key !== 'stack' &&
        !addProperty(error, key, items, depth)
      ) {
        truncated = true
        break
      }
    }
    for (let i = 0; !truncated && i < ERROR_HIDDEN_KEYS.length; i++) {
      const key = ERROR_HIDDEN_KEYS[i]
      if (
        Object.prototype.hasOwnProperty.call(error, key) &&
        !Object.prototype.propertyIsEnumerable.call(error, key)
      ) {
        truncated = !addProperty(error, key, items, depth)
      }
    }

    const result = formatItems(`${text} {`, '}', items, truncated, depth)
    return items.length > 0 ? result : text
  }

  /**
   * Joins formatted items: on one line, or one item per line indented by depth when pretty.
   * Also cuts path back to depth, removing the keys that the items added
   */
  function formatItems(
    start: string,
    end: string,
    items: string[],
    truncated: boolean,
    depth: number,
  ): string {
    if (path != null) {
      path.length = depth
    }
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

  const result = format(obj, 0)
  if (repeated == null || showObjectId) {
    return result
  }
  // A repeated object prints as Name#id after its first occurrence. To print the same id
  // at the first occurrence too, format again: only now it is known which objects repeat
  idsShown = repeated
  visited = null
  return format(obj, 0)
}

function formatNotObject(
  value: any,
  options: null | undefined | FormatAnyOptions,
  depth: number,
  isInsideObject: boolean,
): string {
  if (typeof value === 'string') {
    const str = truncateString(
      value,
      options?.maxStringLength,
      options?.truncateOptions,
    )
    return isInsideObject ? JSON.stringify(str) : str
  }
  if (typeof value === 'function') {
    if (options?.dontExpandFunctions) {
      const name = value.name || 'anonymous'
      if (options.showObjectId) {
        return `function ${name}#${getObjectId(value)}`
      }
      return `function ${name}`
    }
    return indentLines(
      truncateString(
        String(value),
        options?.maxStringLength,
        options?.truncateOptions,
      ),
      options?.pretty,
      depth,
    )
  }
  if (typeof value === 'bigint') {
    return `${value}n`
  }
  return String(value)
}

/**
 * Error name, message, and stack
 * V8 stacks start with the name and message, Firefox and Safari stacks contain only call frames
 */
function getErrorText(error: Error): string {
  const text = String(error)
  const stack = error.stack
  if (!stack || typeof stack !== 'string') {
    return text
  }
  if (stack.startsWith(text)) {
    return stack
  }
  return `${text}\n${stack}`
}

/** The class name to print: empty for a plain object */
function getClassName(obj: any): string {
  return obj.constructor === Object ? '' : (obj.constructor?.name ?? '')
}

/** `Name#id ` when isIdShown, otherwise `Name `, or an empty string for an empty name */
function getPrefix(obj: object, name: string, isIdShown: boolean): string {
  if (isIdShown) {
    return `${name}#${getObjectId(obj)} `
  }
  return name ? `${name} ` : ''
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

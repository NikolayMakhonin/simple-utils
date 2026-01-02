import picomatch from 'picomatch'
import * as path from 'path'
import { pathNormalize } from 'src/node'

/**
 * true - include the path
 * false - exclude the path
 * null - no match, do default action
 */
export type MatchPath = (path: string) => boolean | null
// TODO: write doc comments
export type CreateMatchPathOptions = {
  /**
   * Behavior:
   * let include = false
   * let exclude = false
   *
   * for each glob:
   * if glob matched
   * if pattern is `glob` then include = true; exclude = false
   * if pattern is `!glob` then include = false; exclude = false
   * if pattern is `^glob` then exclude = true
   * if pattern is `^!glob` then exclude = false
   * if pattern is `!^glob` then incorrect should throw error
   *
   * result = include && !exclude
   */
  globs: string[]
  rootDir?: string | null
  noCase?: null | boolean
}

// TODO: write doc comments
/** .gitignore-like path matching function */
export function createMatchPath({
  globs,
  rootDir,
  noCase,
}: CreateMatchPathOptions): MatchPath {
  type Condition = {
    /** exclude element and all its children */
    // exclude `node_modules` + include `node_modules/some-lib` = exclude `node_modules/some-lib`
    // это сделано для избежания лишнего обхода по дереву, чтобы исключать целые папки
    // это может быть целесообразно только для операций с файловой системой,
    // т.к. обход по дереву может быть дорогим
    // это скорее запрет дальнейшего обхода + !include
    exclude: boolean
    negative: boolean
    debugInfo: string
    match: (path: string) => boolean
  }

  const conditions: Condition[] = []
  globs.forEach(glob => {
    glob = pathNormalize(glob).trim()
    const exclude = glob.startsWith('^')
    if (exclude) {
      glob = glob.substring(1).trim()
    }
    const negative = glob.startsWith('!')
    if (negative) {
      glob = glob.substring(1).trim()
    }
    if (glob.startsWith('!') || glob.startsWith('^')) {
      throw new Error(
        `Invalid glob pattern: "${glob}". The syntax '${glob.substring(0, 2)}' is not supported. Valid glob patterns use: * (match any characters), ** (match any directories), ? (match single character), [abc] (character class), ! (negate pattern), ^ (exclude if included). Examples of valid patterns: "*.js", "src/**/*.ts", "!node_modules", "^dist". Avoid starting with '!' after '^' or multiple special prefixes.`,
      )
    }
    if (glob.startsWith('/')) {
      glob = '.' + glob
    }

    const globAbsolute = rootDir
      ? pathNormalize(path.resolve(rootDir, glob))
      : pathNormalize(glob)

    if (!globAbsolute) {
      return
    }

    let matcher: (path: string) => boolean
    try {
      matcher = picomatch(globAbsolute, {
        nocase: noCase ?? false,
        dot: true,
        strictBrackets: true, // Validate bracket balance for patterns like "["
      })
    } catch (error) {
      throw new Error(
        `Invalid glob pattern: "${glob}". ${error instanceof Error ? error.message : 'Unknown error'}. Valid glob patterns use: * (match any characters), ** (match any directories), ? (match single character), [abc] (character class with balanced brackets), ! (negate pattern), ^ (exclude if included). Examples: "*.js", "src/**/*.ts", "!node_modules", "[abc]def.txt". Ensure all brackets [ ] are properly closed and balanced.`,
      )
    }

    conditions.push({
      exclude,
      negative,
      debugInfo: globAbsolute,
      match: matcher,
    })
  })

  return function matchPath(_path: string) {
    _path = pathNormalize(_path)
    let include: boolean | null = null
    let exclude = false
    for (let i = 0, len = conditions.length; i < len; i++) {
      const condition = conditions[i]
      const conditionResult = condition.match(_path)
      if (conditionResult) {
        if (condition.exclude) {
          exclude = !condition.negative
        } else {
          include = !condition.negative
          exclude = false
        }
      }
    }
    return exclude ? false : include
  }
}

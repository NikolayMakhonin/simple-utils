import { IPool, poolRunWait } from '@flemist/time-limits'
import { Priority, priorityCreate } from '@flemist/priority-queue'
import { IAbortSignalFast } from '@flemist/abort-controller-fast'
import * as fs from 'fs'
import {
  combineAbortSignals,
  type PromiseOrValue,
  useAbortController,
} from '@flemist/async-utils'
import * as path from 'path'
import { getFileId, pathResolve } from './helpers'
import { poolFs } from 'src/node'
import { type MatchPath } from 'src/node/fs/glob/createMatchPath'

// TODO: write doc comments
type WalkPathOptionsCommon = {
  paths: string[]
  walkLinks?: null | boolean
  abortSignal?: null | IAbortSignalFast
  pool?: null | IPool
  priority?: null | Priority
  log?: null | WalkPathLogOptions
  handlePath?: null | WalkPathHandlePath
  handleError?: null | WalkPathHandleError
  matchPath?: null | MatchPath
}

/** @internal */
type WalkPathPrivate = WalkPathOptionsCommon & {
  level?: null | number
  walkedIds?: null | Set<string>
}

// TODO: write doc comments
export type WalkPathOptions = WalkPathOptionsCommon

/** @returns true if the error is handled */
export type WalkPathHandleError = (
  err: any,
) => PromiseOrValue<boolean | null | undefined | void>

// TODO: write doc comments
export type WalkPathStat = {
  totalSize: number
  countFiles: number
  countDirs: number
  countLinks: number
  maxFileDateModified: number
}

// TODO: write doc comments
export type WalkPathHandlePathArg = {
  level: number
  path: string
  stat: fs.Stats
  itemStat: WalkPathStat
  totalStat: WalkPathStat
  abortSignal: IAbortSignalFast
}

/**
 * Handler function for processing each discovered path.
 * @param arg - The path processing arguments
 * @returns boolean - true to include this item in totalStat, false to exclude it
 */
export type WalkPathHandlePath = (
  arg: WalkPathHandlePathArg,
) => PromiseOrValue<boolean>

// TODO: write doc comments
export type WalkPathLogOptions = {
  /** Don't log paths deeper than this level */
  maxNestedLevel?: null | number
  /** Don't log paths with total size less than this size */
  minTotalContentSize?: null | number
  handleLog?: null | WalkPathLogFunc
}

// TODO: write doc comments
export type WalkPathLogFunc = (message: string) => PromiseOrValue<void>

// TODO: write doc comments
function addStats(totalStat: WalkPathStat, itemStat: WalkPathStat) {
  totalStat.totalSize += itemStat.totalSize
  totalStat.maxFileDateModified = Math.max(
    totalStat.maxFileDateModified,
    itemStat.maxFileDateModified,
  )
  totalStat.countFiles += itemStat.countFiles
  totalStat.countDirs += itemStat.countDirs
  totalStat.countLinks += itemStat.countLinks
}

// TODO: write doc comments
export const walkPathHandleErrorDefault: WalkPathHandleError =
  function walkPathHandleErrorDefault(err: any) {
    if (err.code === 'ENOENT') {
      return true
    }
    return false
  }

/** @internal */
function _walkPaths(options: WalkPathPrivate): Promise<WalkPathStat> {
  const items = options.paths
  if (!items || items.length === 0) {
    return Promise.resolve({
      totalSize: 0,
      maxFileDateModified: 0,
      countFiles: 0,
      countDirs: 0,
      countLinks: 0,
    })
  }
  const level = options.level ?? 0
  const walkedIds = options.walkedIds ?? new Set<string>()
  const abortSignal = options.abortSignal
  const pool = options.pool ?? poolFs
  const handleError = options.handleError
  const priority = options.priority ?? priorityCreate(0)
  const walkLinks = options.walkLinks ?? false
  const logOptions = options.log
  const handlePath = options.handlePath
  const matchPath = options.matchPath

  async function _handleError(err: any) {
    if (handleError) {
      if (await handleError(err)) {
        return undefined
      }
    }
    if (walkPathHandleErrorDefault(err)) {
      return undefined
    }
    throw err
  }

  function canLog(itemSize: number) {
    if (!logOptions) {
      return false
    }
    if (
      logOptions.minTotalContentSize != null &&
      itemSize < logOptions.minTotalContentSize
    ) {
      return false
    }
    if (
      logOptions.maxNestedLevel != null &&
      level > logOptions.maxNestedLevel
    ) {
      return false
    }
    return true
  }

  return useAbortController(async _abortSignal => {
    const abortSignalCombined = combineAbortSignals(abortSignal, _abortSignal)

    const totalStat: WalkPathStat = {
      totalSize: 0,
      maxFileDateModified: 0,
      countFiles: 0,
      countDirs: 0,
      countLinks: 0,
    }

    function logItem(itemPath: string, itemStat: WalkPathStat) {
      if (canLog(itemStat.totalSize)) {
        // size to string with spaces between thousands
        const sizeStr = itemStat.totalSize
          .toLocaleString('en-US')
          .replace(/,/g, ' ')
          .padStart(19)
        const message = `${sizeStr}: ${itemPath}`
        if (logOptions?.handleLog) {
          logOptions.handleLog(message)
        } else {
          console.log(message)
        }
      }
    }

    async function _handlePath(
      itemPath: string,
      stat: fs.Stats,
      itemStat: WalkPathStat,
      priority: Priority,
    ): Promise<boolean> {
      if (!handlePath) {
        return true
      }
      return await poolRunWait({
        pool,
        func: async () => {
          try {
            return await handlePath({
              level,
              path: itemPath,
              stat,
              itemStat,
              totalStat: totalStat,
              abortSignal: abortSignalCombined,
            })
          } catch (err) {
            await _handleError(err)
            return false
          }
        },
        count: 1,
        priority,
        abortSignal: abortSignalCombined,
      })
    }

    async function processItem(
      /** Original or Symbolic link resolved path */
      resolvedItemPath: string,
      index: number,
      matchResult: boolean | null | undefined,
      /** Original item path before resolving symbolic links */
      originalItemPath?: string | null,
    ): Promise<WalkPathStat | null> {
      if (!originalItemPath) {
        originalItemPath = resolvedItemPath
      }

      const stat = await poolRunWait({
        pool,
        func: () => fs.promises.lstat(resolvedItemPath).catch(_handleError),
        count: 1,
        priority: priorityCreate(index, priorityCreate(1, priority)),
        abortSignal: abortSignalCombined,
      })

      if (!stat) {
        return null
      }

      if (!matchResult && stat.isFile()) {
        return null
      }

      // Check if the file has been walked already
      const itemId = getFileId(resolvedItemPath, stat)
      if (walkedIds.has(itemId)) {
        return null
      }
      walkedIds.add(itemId)

      let itemStat: WalkPathStat = {
        totalSize: stat.size,
        maxFileDateModified: stat.isDirectory() ? 0 : stat.mtimeMs,
        countFiles: 0,
        countDirs: 0,
        countLinks: 0,
      }

      const _priority = priorityCreate(
        index,
        priorityCreate(stat.isDirectory() ? 2 : 3, priority),
      )

      if (stat.isSymbolicLink()) {
        if (walkLinks) {
          const link: string = (await poolRunWait({
            pool,
            func: () =>
              fs.promises
                .readlink(resolvedItemPath)
                .catch(_handleError)
                .then(link => link ?? null),
            count: 1,
            priority: _priority,
            abortSignal: abortSignalCombined,
          })) as string

          if (link) {
            const resolvedLink = path.isAbsolute(link)
              ? link
              : path.resolve(path.dirname(originalItemPath), link)
            const linkedItemStat = await processItem(
              resolvedLink,
              index,
              matchResult,
              originalItemPath,
            )
            if (linkedItemStat) {
              itemStat = linkedItemStat
            }
          }
        }

        if (
          matchResult ||
          itemStat.countFiles + itemStat.countDirs + itemStat.countLinks >= 1
        ) {
          itemStat.countLinks += 1
          const shouldInclude = await _handlePath(
            originalItemPath,
            stat,
            itemStat,
            _priority,
          )
          if (shouldInclude) {
            addStats(totalStat, itemStat)
            logItem(originalItemPath, itemStat)
          }
        }

        return itemStat
      } else if (stat.isDirectory()) {
        // Get items from the directory
        const dirItems = await poolRunWait({
          pool,
          func: () => fs.promises.readdir(resolvedItemPath).catch(_handleError),
          count: 1,
          priority,
          abortSignal: abortSignalCombined,
        })

        if (dirItems) {
          for (let i = 0, len = dirItems.length; i < len; i++) {
            dirItems[i] = path.join(originalItemPath, dirItems[i])
          }
          itemStat = await _walkPaths({
            ...options,
            paths: dirItems,
            abortSignal: abortSignalCombined,
            priority: _priority,
            level: level + 1,
            walkedIds,
          })
        }
      }

      if (
        matchResult ||
        itemStat.countFiles + itemStat.countDirs + itemStat.countLinks >= 1
      ) {
        if (stat.isDirectory()) {
          itemStat.countDirs += 1
        } else if (stat.isFile()) {
          itemStat.countFiles += 1
        }
        const shouldInclude = await _handlePath(
          originalItemPath,
          stat,
          itemStat,
          _priority,
        )
        if (shouldInclude) {
          addStats(totalStat, itemStat)
          logItem(originalItemPath, itemStat)
        }
      }

      return itemStat
    }

    const promises: Promise<WalkPathStat | null>[] = []
    for (let i = 0, len = items.length; i < len; i++) {
      const itemPath = pathResolve(items[i])
      const matchResult = matchPath ? matchPath(itemPath) : true
      if (matchResult === false) {
        continue
      }
      promises.push(processItem(itemPath, i, matchResult))
    }

    await Promise.all(promises)

    return totalStat
  })
}

// TODO: write doc comments
export function walkPaths(options: WalkPathOptions): Promise<WalkPathStat> {
  return _walkPaths(options)
}

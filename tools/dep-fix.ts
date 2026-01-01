// @ai ChatGPT
// TODO: use pool from @flemist/time-limits to limit concurrent fetches

import * as fs from 'fs'
import * as path from 'path'
// import { pool } from '@flemist/time-limits'

type Options = {
  maxAgeDays: number
  updateAll: boolean
}

type PackageJson = {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
  [key: string]: unknown
}

type NpmMeta = {
  time: Record<string, string>
}

type FixedDeps = Record<string, string>

const PKG_PATH: string = path.join(process.cwd(), 'package.json')
const debug = true

function log(...args: unknown[]): void {
  if (!debug) {
    return
  }
  console.log(...args)
}

function parseArgs(): Options {
  const [daysArg, flag] = process.argv.slice(2)
  const maxAgeDays = Number(daysArg) || 365
  const updateAll = flag === 'all'
  if (debug) {
    log('Args parsed:', { maxAgeDays, updateAll })
  }
  return { maxAgeDays, updateAll }
}

async function readJson(filePath: string): Promise<PackageJson> {
  if (debug) {
    log('Reading JSON:', filePath)
  }
  const text = await fs.promises.readFile(filePath, 'utf8')
  const data = JSON.parse(text) as PackageJson
  if (debug) {
    log('Read JSON complete:', Object.keys(data))
  }
  return data
}

async function writeJson(filePath: string, data: PackageJson): Promise<void> {
  if (debug) {
    log('Writing JSON:', filePath)
  }
  const text = JSON.stringify(data, null, 2)
  await fs.promises.writeFile(filePath, text)
  if (debug) {
    log('Write complete')
  }
}

async function fetchMeta(name: string): Promise<NpmMeta> {
  if (debug) {
    log('Fetching meta for', name)
  }
  const res = await fetch(`https://registry.npmjs.org/${name}`)
  if (!res.ok) {
    throw new Error(`${name}: ${res.status} ${res.statusText}`)
  }
  const meta = (await res.json()) as NpmMeta
  if (debug) {
    log('Fetched meta keys for', name, Object.keys(meta.time).length)
  }
  return meta
}

function isOlderThan(date: string, days: number): boolean {
  return new Date(date).getTime() < Date.now() - days * 86_400_000
}

function isStableVersion(version: string): boolean {
  // any version with '-' after digits is pre-release
  const hasDash = version.includes('-')
  if (debug && hasDash) {
    log('Skipping pre-release version:', version)
  }
  return !hasDash
}

function latestOlderThan(meta: NpmMeta, days: number): null | string {
  if (debug) {
    log('Selecting latest stable older than', days, 'days')
  }
  const entries = Object.entries(meta.time)
  const filtered: [string, number][] = []
  let minTimestamp = Infinity
  let maxTimestamp = 0

  for (let i = 0, len = entries.length; i < len; i++) {
    const [version, date] = entries[i]
    if (version === 'created' || version === 'modified') {
      continue
    }
    if (!isStableVersion(version)) {
      continue
    }
    const versionTimestamp = new Date(date).getTime()
    if (versionTimestamp < minTimestamp) {
      minTimestamp = versionTimestamp
    }
    if (versionTimestamp > maxTimestamp) {
      maxTimestamp = versionTimestamp
    }
    if (versionTimestamp < Date.now() - days * 86_400_000) {
      filtered.push([version, versionTimestamp])
    }
  }

  if (debug) {
    log('Version date range:', {
      earliest: new Date(minTimestamp).toISOString(),
      latest  : new Date(maxTimestamp).toISOString(),
    })
  }

  if (!filtered.length) {
    if (debug) {
      log('No stable versions older than', days, 'days')
    }
    return null
  }

  filtered.sort((a, b) => b[1] - a[1])
  const selected = filtered[0][0]
  if (debug) {
    log('Selected older stable version:', selected)
  }
  return selected
}

async function fixDepsGroup(
  deps: Record<string, string>,
  options: Options,
  groupName: string,
): Promise<FixedDeps> {
  if (debug) {
    log(`Fixing ${groupName}:`, Object.keys(deps))
  }
  const fixed: FixedDeps = {}
  const keys = Object.keys(deps)

  for (let i = 0, len = keys.length; i < len; i++) {
    const name = keys[i]
    const verRaw = deps[name]
    const current = verRaw.replace(/^[^\d]*/, '')
    if (debug) {
      log(`Processing ${groupName} ${name}@${current}`)
    }
    const meta = await fetchMeta(name)
    const time = meta.time
    const currentTime = time?.[current]

    const isTooNew = !currentTime || !isOlderThan(currentTime, options.maxAgeDays)
    const needs = options.updateAll || isTooNew
    if (!needs) {
      if (debug) {
        log('No update needed for', name)
      }
      continue
    }

    const latest = latestOlderThan(meta, options.maxAgeDays)
    if (latest) {
      fixed[name] = `^${latest}`
      if (debug) {
        log('Will fix', name, '→', latest)
      }
    }
    else {
      const allStable = Object.keys(time)
        .filter(v => v !== 'created' && v !== 'modified' && isStableVersion(v))
        .sort(
          (a, b) => new Date(time[b]).getTime() - new Date(time[a]).getTime(),
        )
      const newest = allStable[0]
      if (debug) {
        log(
          'No suitable stable version found for',
          name,
          '| Newest stable available:',
          newest,
          time[newest],
        )
      }
    }
  }

  if (debug) {
    log(`Finished ${groupName}. Fixed:`, fixed)
  }
  return fixed
}

async function main(): Promise<void> {
  const start = Date.now()
  if (debug) {
    log('--- dep-fix started ---', new Date(start).toISOString())
  }

  const options = parseArgs()
  const pkg = await readJson(PKG_PATH)

  const allGroups: Record<string, Record<string, string>> = {
    dependencies        : pkg.dependencies || {},
    devDependencies     : pkg.devDependencies || {},
    peerDependencies    : pkg.peerDependencies || {},
    optionalDependencies: pkg.optionalDependencies || {},
  }

  const totalFixed: Record<string, FixedDeps> = {}
  for (const [group, deps] of Object.entries(allGroups)) {
    if (!Object.keys(deps).length) {
      continue
    }
    totalFixed[group] = await fixDepsGroup(deps, options, group)
  }

  let changed = false
  for (const [group, fixed] of Object.entries(totalFixed)) {
    if (Object.keys(fixed).length) {
      (pkg as any)[group] = { ...(pkg as any)[group], ...fixed }
      changed = true
    }
  }

  if (changed) {
    await writeJson(PKG_PATH, pkg)
    log('Dependencies fixed:', totalFixed)
  }
  else {
    log('No dependencies need fixing')
  }

  const end = Date.now()
  if (debug) {
    log(
      '--- dep-fix finished ---',
      new Date(end).toISOString(),
      '| Duration:',
      end - start,
      'ms',
    )
  }
}

main().catch((err: Error) => {
  console.error('Error:', err.message)
  process.exit(1)
})

#!/usr/bin/env node

import * as fs from 'fs'
import * as path from 'path'

type Options = {
  maxAgeDays: number
  updateAll: boolean
}

type PackageJson = {
  dependencies?: Record<string, string>
  [key: string]: unknown
}

type NpmMeta = {
  time: Record<string, string>
}

type FixedDeps = Record<string, string>

const PKG_PATH: string = path.join(process.cwd(), 'package.json')
const debug = true

function log(...args: unknown[]): void {
  if (!debug) return
  console.log(...args)
}

function parseArgs(): Options {
  const [daysArg, flag] = process.argv.slice(2)
  const maxAgeDays = Number(daysArg) || 365
  const updateAll = flag === 'all'
  if (debug) log('Args parsed:', { maxAgeDays, updateAll })
  return { maxAgeDays, updateAll }
}

async function readJson(filePath: string): Promise<PackageJson> {
  if (debug) log('Reading JSON:', filePath)
  const text = await fs.promises.readFile(filePath, 'utf8')
  const data = JSON.parse(text) as PackageJson
  if (debug) log('Read JSON complete:', Object.keys(data))
  return data
}

async function writeJson(filePath: string, data: PackageJson): Promise<void> {
  if (debug) log('Writing JSON:', filePath)
  const text = JSON.stringify(data, null, 2)
  await fs.promises.writeFile(filePath, text)
  if (debug) log('Write complete')
}

async function fetchMeta(name: string): Promise<NpmMeta> {
  if (debug) log('Fetching meta for', name)
  const res = await fetch(`https://registry.npmjs.org/${name}`)
  if (!res.ok) throw new Error(`${name}: ${res.status} ${res.statusText}`)
  const meta = (await res.json()) as NpmMeta
  if (debug) log('Fetched meta keys for', name, Object.keys(meta.time).length)
  return meta
}

function isOlderThan(date: string, days: number): boolean {
  const result = new Date(date).getTime() < Date.now() - days * 86_400_000
  if (debug) log('isOlderThan', date, days, '→', result)
  return result
}

function latestOlderThan(meta: NpmMeta, days: number): null | string {
  if (debug) log('Selecting latest older than', days, 'days')
  const entries = Object.entries(meta.time)
  const filtered: [string, number][] = []
  for (let i = 0, len = entries.length; i < len; i++) {
    const [ver, time] = entries[i]
    if (ver === 'created' || ver === 'modified') continue
    const t = new Date(time).getTime()
    if (t < Date.now() - days * 86_400_000) filtered.push([ver, t])
  }
  if (!filtered.length) {
    if (debug) log('No older versions found')
    return null
  }
  filtered.sort((a, b) => b[1] - a[1])
  const selected = filtered[0][0]
  if (debug) log('Selected older version:', selected)
  return selected
}

async function fixDeps(
  deps: Record<string, string>,
  options: Options
): Promise<FixedDeps> {
  if (debug) log('Fixing dependencies:', Object.keys(deps))
  const fixed: FixedDeps = {}
  const keys = Object.keys(deps)
  for (let i = 0, len = keys.length; i < len; i++) {
    const name = keys[i]
    const verRaw = deps[name]
    const current = verRaw.replace(/^[^\d]*/, '')
    if (debug) log(`Processing ${name}@${current}`)
    const meta = await fetchMeta(name)
    const time = meta.time
    const currentTime = time?.[current]
    const needs =
      options.updateAll || !currentTime || isOlderThan(currentTime, options.maxAgeDays)
    if (!needs) {
      if (debug) log('No update needed for', name)
      continue
    }
    const latest = latestOlderThan(meta, options.maxAgeDays)
    if (latest) {
      fixed[name] = `^${latest}`
      if (debug) log('Will fix', name, '→', latest)
    } else {
      if (debug) log('No suitable version found for', name)
    }
  }
  if (debug) log('Fixing complete. Fixed deps:', fixed)
  return fixed
}

async function main(): Promise<void> {
  if (debug) log('--- dep-fix started ---')
  const options = parseArgs()
  const pkg = await readJson(PKG_PATH)
  const deps = pkg.dependencies || {}
  const fixed = await fixDeps(deps, options)
  const hasChanges = Object.keys(fixed).length > 0
  if (hasChanges) {
    pkg.dependencies = { ...deps, ...fixed }
    await writeJson(PKG_PATH, pkg)
    log('Dependencies fixed:', fixed)
  } else {
    log('No dependencies need fixing')
  }
  if (debug) log('--- dep-fix finished ---')
}

main().catch((err: Error) => {
  console.error('Error:', err.message)
  process.exit(1)
})

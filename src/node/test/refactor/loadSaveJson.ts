import * as path from 'path'
import * as fs from 'fs'

export async function saveJson(filePath: string, json) {
  const dir = path.dirname(filePath)
  if (!(await fs.promises.stat(dir).catch(() => null))) {
    await fs.promises.mkdir(dir, { recursive: true })
  }
  await fs.promises.writeFile(filePath, JSON.stringify(json, null, 4), {
    encoding: 'utf-8',
  })
}

export async function loadJson(filePath: string) {
  if (!(await fs.promises.stat(filePath).catch(() => null))) {
    return null
  }
  const jsonStr = await fs.promises.readFile(filePath, { encoding: 'utf-8' })
  return JSON.parse(jsonStr)
}

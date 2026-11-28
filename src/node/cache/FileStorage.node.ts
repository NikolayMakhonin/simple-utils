import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { FileStorage, getFileStoragePath } from './FileStorage'
import { FileStatStorage } from './FileStatStorage'
import { createConverterSubPath } from './createConverterSubPath'

const DIR_TMP = '-tmp/-test/FileStorage'
const DIR_STORAGE = DIR_TMP + '/storage'

function createStorage(prefix?: null | string): FileStorage {
  return new FileStorage({
    dir: DIR_STORAGE,
    tmpDir: DIR_TMP + '/tmp',
    converterSubPath: createConverterSubPath({ prefix, suffix: '.value' }),
  })
}

beforeEach(async () => {
  await fs.promises.rm(DIR_TMP, { recursive: true, force: true })
})

afterEach(async () => {
  await fs.promises.rm(DIR_TMP, { recursive: true, force: true })
})

describe('getFileStoragePath', () => {
  it('a key cannot reach a file outside of dir', async () => {
    const storage = createStorage()
    const fileOutside = path.join(DIR_TMP, 'outside.value')
    await fs.promises.mkdir(DIR_TMP, { recursive: true })
    await fs.promises.writeFile(fileOutside, 'outside')

    const keys = [
      '../outside',
      'a/../../outside',
      '..\\outside',
      'a\\..\\..\\outside',
    ]
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      expect(() => getFileStoragePath(storage.options, key)).toThrow(
        '[getFileStoragePath]',
      )
      await expect(storage.get(key)).rejects.toThrow('[getFileStoragePath]')
      await expect(storage.set(key, new Uint8Array([1]))).rejects.toThrow(
        '[getFileStoragePath]',
      )
      await expect(storage.delete(key)).rejects.toThrow('[getFileStoragePath]')
    }
    expect(await fs.promises.readFile(fileOutside, 'utf8')).toBe('outside')
  })

  it('a sub path that stays inside dir gives its file', () => {
    const options = createStorage().options
    expect(getFileStoragePath(options, 'a/../b')).toBe(
      path.join(DIR_STORAGE, 'b.value'),
    )
    expect(getFileStoragePath(options, '..b')).toBe(
      path.join(DIR_STORAGE, '..b.value'),
    )
  })
})

describe('FileStatStorage', () => {
  it('keeps a stat in the file of the value also for a sub path that starts with a slash', async () => {
    const storage = createStorage('/p/')
    const statStorage = new FileStatStorage({ storages: { value: storage } })
    await storage.set('key', new Uint8Array([1, 2, 3]))
    const date = Date.UTC(2020, 0, 1)
    await statStorage.set('key', {
      dateModified: date,
      dateUsed: date + 1000,
      size: 3,
    })
    expect(await statStorage.get('key')).toEqual({
      dateModified: date,
      dateUsed: date + 1000,
      size: 3,
      hasError: false,
    })
  })
})

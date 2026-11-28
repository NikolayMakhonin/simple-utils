import { describe, it, expect, vi, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { writeFileThroughTmp } from './writeFileThroughTmp'

const DIR_TMP = '-tmp/-test/writeFileThroughTmp'
const FILE_PATH = DIR_TMP + '/dir/file'
const TMP_PATH = DIR_TMP + '/tmp/file.tmp'

describe('writeFileThroughTmp', () => {
  afterEach(async () => {
    vi.restoreAllMocks()
    await fs.promises.rm(DIR_TMP, { recursive: true, force: true })
  })

  it('a write that fails after it created the temporary file deletes that file', async () => {
    const error = new Error('write error')
    const writeFile = fs.promises.writeFile
    vi.spyOn(fs.promises, 'writeFile').mockImplementation(async file => {
      await writeFile(file, 'part')
      throw error
    })
    await expect(
      writeFileThroughTmp(FILE_PATH, TMP_PATH, new Uint8Array([1])),
    ).rejects.toBe(error)
    await expect(fs.promises.stat(TMP_PATH)).rejects.toMatchObject({
      code: 'ENOENT',
    })
  })

  it('a temporary file that cannot be deleted is reported by console.warn', async () => {
    const error = new Error('rename error')
    const unlinkError = Object.assign(new Error('unlink error'), {
      code: 'EPERM',
    })
    vi.spyOn(fs.promises, 'rename').mockRejectedValue(error)
    vi.spyOn(fs.promises, 'unlink').mockRejectedValue(unlinkError)
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await expect(
      writeFileThroughTmp(FILE_PATH, TMP_PATH, new Uint8Array([1])),
    ).rejects.toBe(error)
    expect(consoleWarn.mock.calls).toEqual([
      [
        `[writeFileThroughTmp] the temporary file (${path.resolve(TMP_PATH)}) could not be deleted`,
        unlinkError,
      ],
    ])
  })

  it('a write that fails before it created the temporary file logs nothing', async () => {
    const error = new Error('write error')
    vi.spyOn(fs.promises, 'writeFile').mockRejectedValue(error)
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await expect(
      writeFileThroughTmp(FILE_PATH, TMP_PATH, new Uint8Array([1])),
    ).rejects.toBe(error)
    expect(consoleWarn).not.toHaveBeenCalled()
  })
})

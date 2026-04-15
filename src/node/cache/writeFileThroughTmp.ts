import { type IPool, poolRunWait } from '@flemist/time-limits'
import path from 'path'
import { poolFs } from 'src/node/fs/pools'
import fs from 'fs'
import { promiseAllWait } from '../../common'

export async function writeFileThroughTmp(
  filePath: string,
  tmpPath: string,
  data: Uint8Array,
  pool?: null | IPool,
): Promise<void> {
  filePath = path.resolve(filePath)
  tmpPath = path.resolve(tmpPath)
  await poolRunWait({
    pool: pool ?? poolFs,
    count: 1,
    func: async () => {
      let tmpWritten = false
      try {
        await promiseAllWait([
          fs.promises.mkdir(path.dirname(filePath), { recursive: true }),
          (async () => {
            await fs.promises.mkdir(path.dirname(tmpPath), { recursive: true })
            await fs.promises.writeFile(tmpPath, data)
            tmpWritten = true
          })(),
        ])
        await fs.promises.rename(tmpPath, filePath)
      } catch (err) {
        if (tmpWritten) {
          await fs.promises.unlink(tmpPath).catch(() => {})
        }
        throw err
      }
    },
  })
}

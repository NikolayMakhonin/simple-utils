import { type IPool } from 'src/common/async/pool/Pool'
import { poolRunWait } from 'src/common/async/pool/poolRunWait'
import * as path from 'path'
import { poolFs } from 'src/node/fs/pools'
import * as fs from 'fs'
import { promiseAllWait } from 'src/common'

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
      let isTmpWriteStarted = false
      try {
        await promiseAllWait([
          fs.promises.mkdir(path.dirname(filePath), { recursive: true }),
          (async () => {
            await fs.promises.mkdir(path.dirname(tmpPath), { recursive: true })
            // Set before writeFile, because a writeFile that fails can leave a part of the file
            isTmpWriteStarted = true
            await fs.promises.writeFile(tmpPath, data)
          })(),
        ])
        await fs.promises.rename(tmpPath, filePath)
      } catch (err) {
        if (isTmpWriteStarted) {
          await fs.promises.unlink(tmpPath).catch(unlinkError => {
            // ENOENT means that writeFile failed before it created the file
            if (unlinkError.code !== 'ENOENT') {
              console.warn(
                `[writeFileThroughTmp] the temporary file (${tmpPath}) could not be deleted`,
                unlinkError,
              )
            }
          })
        }
        throw err
      }
    },
  })
}

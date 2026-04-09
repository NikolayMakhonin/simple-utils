import { spawn, type SpawnOptions } from 'child_process'

export function exec(command: string, params: SpawnOptions = {}) {
  return new Promise<string>((resolve, reject) => {
    const proc = spawn(command, {
      shell: true,
      ...params,
    })

    const chunks: Buffer[] = []

    proc.stdout!.on('data', data => {
      chunks.push(data)
    })

    proc.on('error', err => {
      reject(err)
    })

    proc.on('exit', code => {
      const result = Buffer.concat(chunks).toString('utf8')
      if (code !== 0) {
        // console.log(result)
        reject(new Error(`[exec][exit] code: ${code}`))
        return
      }
      resolve(result)
    })
  })
}

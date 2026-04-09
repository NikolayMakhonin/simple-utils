import { ChildProcess, spawn } from 'child_process'

export async function nodeBeep(): Promise<void> {
  let child: ChildProcess

  switch (process.platform) {
    case 'darwin':
      child = spawn('afplay', ['/System/Library/Sounds/Ping.aiff'], {
        stdio: 'ignore',
      })
      break
    case 'linux':
      child = spawn('beep', [], { stdio: 'ignore', shell: true })
      break
    case 'win32':
      child = spawn('powershell', ['-c', '[console]::beep(1000,300)'], {
        stdio: 'ignore',
      })
      break
    default:
      throw new Error(
        `[nodeBeep] Beep not supported on platform: ${process.platform}`,
      )
  }

  await new Promise<void>((resolve, reject) => {
    child.on('error', reject)
    child.on('close', code => {
      if (code !== 0) {
        reject(new Error(`[nodeBeep] Beep process exited with code ${code}`))
      } else {
        resolve()
      }
    })
  })
}

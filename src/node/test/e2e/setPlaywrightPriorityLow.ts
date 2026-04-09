import { exec } from 'src/node/process/exec'

export async function setPlaywrightPriorityLow() {
  // set browser server process priority to Low:
  try {
    // see: https://superuser.com/a/620725
    // wmic process /?
    // wmic process list
    if (process.platform === 'win32') {
      await exec(
        `wmic process where "commandline like '%ms-playwright%' and not commandline like '%wmic.exe%' and priority != 4" CALL setpriority "idle"`,
      )
    }
  } catch (error: any) {
    const message = error?.message?.trim()
    if (/exit code: 2147749890/.test(message)) {
      // "Thing was not found" error
      return
    }
    console.warn('[test][setPlaywrightPriorityLow] error: ' + message)
  }
}

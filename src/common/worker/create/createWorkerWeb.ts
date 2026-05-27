import type { IWorker } from '../types'
import { WorkerWeb } from './WorkerWeb'

export async function createWorkerWeb(
  workerPathOrUrl: string | URL,
): Promise<IWorker> {
  const webWorker = new Worker(workerPathOrUrl, { type: 'module' })
  const worker = new WorkerWeb(webWorker)
  worker.on('error', error => {
    console.error(error)
  })
  return worker
}

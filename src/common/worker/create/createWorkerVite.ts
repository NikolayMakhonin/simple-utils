import { WorkerNode } from './WorkerNode'
import { type IWorker, WorkerError, WorkerErrorType } from '../types'
import { createWorkerWeb } from './createWorkerWeb'

const viteWorkerUrl = new URL('./vite-worker.mjs', import.meta.url)

async function _createWorkerViteNode(
  workerPathOrUrl: string | URL,
): Promise<IWorker> {
  const [{ Worker: NodeWorker }, { fileURLToPath }] = await Promise.all([
    import('worker_threads'),
    import('url'),
  ])
  const nodeWorker = new NodeWorker(fileURLToPath(viteWorkerUrl), {
    workerData: {
      scriptPath:
        workerPathOrUrl instanceof URL
          ? fileURLToPath(workerPathOrUrl)
          : workerPathOrUrl,
    },
  })
  const worker = new WorkerNode(nodeWorker)
  worker.on('error', error => {
    console.error(error)
  })

  await new Promise<void>((resolve, reject) => {
    worker.on('message', (message: any) => {
      if (message === 'ready') {
        resolve()
      } else {
        reject(
          new WorkerError(
            WorkerErrorType.messageError,
            `[WorkerViteNode] unexpected message: ${JSON.stringify(message)}`,
          ),
        )
      }
    })
  })

  return worker
}

let prevCreateWorkerViteNodePromise: Promise<IWorker> | null = null
export async function createWorkerViteNode(
  workerPathOrUrl: string | URL,
): Promise<IWorker> {
  // Vite node workers cannot be created in parallel, otherwise there will be errors
  if (prevCreateWorkerViteNodePromise) {
    prevCreateWorkerViteNodePromise = prevCreateWorkerViteNodePromise.then(
      () => _createWorkerViteNode(workerPathOrUrl),
      () => _createWorkerViteNode(workerPathOrUrl),
    )
  } else {
    prevCreateWorkerViteNodePromise = _createWorkerViteNode(workerPathOrUrl)
  }
  return prevCreateWorkerViteNodePromise
}

export async function createWorkerVite(
  workerPathOrUrl: string | URL,
): Promise<IWorker> {
  if (typeof Worker === 'undefined') {
    return createWorkerViteNode(workerPathOrUrl)
  }
  return createWorkerWeb(workerPathOrUrl)
}

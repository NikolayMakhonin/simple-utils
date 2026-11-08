import { WorkerNode } from './WorkerNode'
import { type IWorker, WorkerError, WorkerErrorType } from '../types'
import { formatAny } from 'src/common/string/format/formatAny'

// A variable, because a bundler follows a literal import: it would put Vite into the build
// of this library and into every application bundle with this function, while Vite
// must load from the node_modules of the project
const VITE_MODULE_NAME = 'vite'

async function _createWorkerVite(
  workerPathOrUrl: string | URL,
): Promise<IWorker> {
  const [{ Worker: NodeWorker }, { fileURLToPath }] = await Promise.all([
    import('worker_threads'),
    import('url'),
    // Vite must stay loaded in this thread, because the whole process can crash
    // with an access violation when the last thread using its native addon exits
    // see: https://github.com/napi-rs/package-template/issues/308
    import(/* @vite-ignore */ VITE_MODULE_NAME),
  ])
  const viteWorkerUrl = new URL(
    './-res/vite-worker.mjs?no-inline',
    import.meta.url,
  )
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
    console.error(
      `[createWorkerVite] error in the thread of ${String(workerPathOrUrl)}`,
      error,
    )
  })

  await new Promise<void>((resolve, reject) => {
    function unsubscribe() {
      worker.off('message', onMessage)
      worker.off('error', onError)
    }
    function onMessage(message: any) {
      unsubscribe()
      if (message === 'ready') {
        resolve()
      } else {
        void worker.terminate()
        reject(
          new WorkerError(
            WorkerErrorType.messageError,
            `[createWorkerVite] unexpected message: ${formatAny(message)}`,
          ),
        )
      }
    }
    function onError(error: Error) {
      unsubscribe()
      reject(error)
    }
    worker.on('message', onMessage)
    worker.on('error', onError)
  })

  return worker
}

let prevCreateWorkerVitePromise: Promise<IWorker> | null = null

/**
 * Creates a worker thread that runs a source module of the project
 * with the module runner of the Vite of the project
 */
export async function createWorkerVite(
  workerPathOrUrl: string | URL,
): Promise<IWorker> {
  // Vite node workers cannot be created in parallel, otherwise there will be errors
  if (prevCreateWorkerVitePromise) {
    prevCreateWorkerVitePromise = prevCreateWorkerVitePromise.then(
      () => _createWorkerVite(workerPathOrUrl),
      () => _createWorkerVite(workerPathOrUrl),
    )
  } else {
    prevCreateWorkerVitePromise = _createWorkerVite(workerPathOrUrl)
  }
  return prevCreateWorkerVitePromise
}

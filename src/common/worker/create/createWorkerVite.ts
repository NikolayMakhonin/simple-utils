import { WorkerNode } from './WorkerNode'
import { type IWorker, WorkerError, WorkerErrorType } from '../types'
import { formatAny } from 'src/common/string/format/formatAny'

// The module name is in a variable, so that bundlers cannot follow the import.
// A followed import would put Vite into the build of this library
// and into the bundle of every app that uses createWorkerVite.
// Vite must be loaded from the node_modules of the app
const VITE_MODULE_NAME = 'vite'

async function _createWorkerVite(
  workerPathOrUrl: string | URL,
): Promise<IWorker> {
  const [{ Worker: NodeWorker }, { fileURLToPath }] = await Promise.all([
    import('worker_threads'),
    import('url'),
    // Vite is loaded in this thread too: the process can crash when a worker thread
    // exits while it is the only thread that has loaded Vite's native addon
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
      `[createWorkerVite] error in the worker thread` +
        ` of script (${String(workerPathOrUrl)})`,
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
            `[createWorkerVite] the worker thread posted a message before 'ready'` +
              `: ${formatAny(message)}`,
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
 * Starts a Node.js worker thread that runs the source file (TypeScript, etc)
 * through the Vite installed in the project, with the vite config of the project.
 * Resolves after the file has been imported.
 * Rejects when the file throws or posts a message during the import
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

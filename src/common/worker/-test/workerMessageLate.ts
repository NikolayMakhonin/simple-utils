import { parentPort } from 'worker_threads'

setTimeout(() => {
  parentPort!.postMessage(1n)
}, 100)

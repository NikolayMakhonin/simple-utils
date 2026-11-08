import { parentPort } from 'worker_threads'

parentPort!.postMessage(1n)

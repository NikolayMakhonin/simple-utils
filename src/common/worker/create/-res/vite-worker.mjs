import { parentPort, workerData } from 'node:worker_threads'
import { createServer, createServerModuleRunner } from 'vite'

async function run() {
  // create vite server
  // middlewareMode prevents binding an HTTP port,
  // so the worker exits cleanly when terminated
  const server = await createServer({
    server: {
      middlewareMode: true,
      hmr: false,
      ws: false,
    },
    optimizeDeps: {
      // No browser loads modules from this server, so it needs no dependency optimization
      noDiscovery: true,
    },
  })

  parentPort.on('close', () => {
    server.close()
  })

  // The module runner of the Vite of the project, so that the vite config
  // of the project runs in the Vite version it was written for;
  // it maps stack traces to the sources by default
  const runner = createServerModuleRunner(server.environments.ssr, {
    hmr: false,
  })

  // execute the file and wait for it to finish
  await runner.import(workerData.scriptPath)

  parentPort.postMessage('ready')
}

void run()

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
      // Dependency optimization is for browsers, and no browser loads modules from this server
      noDiscovery: true,
    },
  })

  parentPort.on('close', () => {
    server.close()
  })

  // The module runner of the Vite installed in the project, so that the vite config
  // of the project runs on the Vite version it was written for.
  // The runner maps stack traces to the source files by default
  const runner = createServerModuleRunner(server.environments.ssr, {
    hmr: false,
  })

  // execute the file and wait for it to finish
  await runner.import(workerData.scriptPath)

  parentPort.postMessage('ready')
}

void run()

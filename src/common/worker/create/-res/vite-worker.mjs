import { parentPort, workerData } from 'node:worker_threads'
import { createServer, createServerModuleRunner } from 'vite'

async function run() {
  // With middlewareMode, Vite creates no HTTP server, which the thread does not use
  const server = await createServer({
    server: {
      middlewareMode: true,
      hmr: false,
      ws: false,
      // The thread never reloads changed files, so it needs no file watcher.
      // With the watcher, the start of a thread took about 4 s longer on Windows
      watch: null,
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

  await runner.import(workerData.scriptPath)

  parentPort.postMessage('ready')
}

void run()

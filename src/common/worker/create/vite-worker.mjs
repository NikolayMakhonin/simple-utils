// from: https://dev.to/composite/nodejs-worker-thread-with-typescript-5b00
import { workerData } from 'node:worker_threads'
import { createServer } from 'vite'
import { ViteNodeRunner } from 'vite-node/client'
import { ViteNodeServer } from 'vite-node/server'
import { installSourcemapsSupport } from 'vite-node/source-map'

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
      // It's recommended to disable deps optimization
      noDiscovery: true,
      include: undefined,
    },
  })

  // create vite-node server
  const node = new ViteNodeServer(server)

  // fixes stack traces in Errors
  installSourcemapsSupport({
    getSourceMap: source => node.getSourceMap(source),
  })

  // create vite-node runner
  const runner = new ViteNodeRunner({
    root: server.config.root,
    base: server.config.base,
    // when having the server and runner in a different context,
    // you will need to handle the communication between them
    // and pass to this function
    fetchModule(id) {
      return node.fetchModule(id)
    },
    resolveId(id, importer) {
      return node.resolveId(id, importer)
    },
  })

  // execute the file
  await runner.executeFile(workerData.scriptPath)

  // close the vite server
  await server.close()
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})

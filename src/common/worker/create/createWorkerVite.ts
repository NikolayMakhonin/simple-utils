const viteWorkerUrl = new URL('./vite-worker.mjs', import.meta.url)

export async function createWorkerViteNode(
  workerPathOrUrl: string | URL,
): Promise<Worker> {
  const [{ Worker: NodeWorker }, { fileURLToPath }] = await Promise.all([
    import('worker_threads'),
    import('url'),
  ])
  return new NodeWorker(fileURLToPath(viteWorkerUrl), {
    workerData: {
      scriptPath:
        workerPathOrUrl instanceof URL
          ? fileURLToPath(workerPathOrUrl)
          : workerPathOrUrl,
    },
  }) as unknown as Worker
}

export async function createWorkerVite(
  workerPathOrUrl: string | URL,
): Promise<Worker> {
  if (typeof Worker === 'undefined') {
    return createWorkerViteNode(workerPathOrUrl)
  }
  return new Worker(workerPathOrUrl, { type: 'module' })
}

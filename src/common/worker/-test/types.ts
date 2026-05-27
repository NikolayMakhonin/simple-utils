export type WorkerFunctionTestInput = {
  a: number
  b: number
  steps: number
  stepDurationMs: number
}

export type WorkerFunctionTestOutput = {
  result: number
  completedSteps: number
  workerId: string
}

export type WorkerFunctionTestCallback = {
  progress: number
  workerId: string
}

import type {
  WorkerEventFire,
  WorkerEventRequest,
  WorkerEventResponse,
  WorkerEventResponseError,
} from '../function/types'

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
  product: number
}

export type WorkerFunctionTestProgress = {
  progress: number
  workerId: string
}

export type WorkerFunctionTestMultiplyRequest = {
  x: number
  y: number
}

export type WorkerFunctionTestMultiplyResponse = {
  product: number
  workerId: string
}

export type WorkerFunctionTestClientEvent =
  | WorkerEventFire<WorkerFunctionTestProgress>
  | WorkerEventRequest<WorkerFunctionTestMultiplyRequest>
  | WorkerEventResponse<WorkerFunctionTestMultiplyResponse>
  | WorkerEventResponseError

export type WorkerFunctionTestServerEvent =
  | WorkerEventFire<WorkerFunctionTestProgress>
  | WorkerEventRequest<WorkerFunctionTestMultiplyRequest>
  | WorkerEventResponse<WorkerFunctionTestMultiplyResponse>
  | WorkerEventResponseError

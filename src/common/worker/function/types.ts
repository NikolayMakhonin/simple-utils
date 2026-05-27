import type { IAbortSignalFast } from '@flemist/abort-controller-fast'
import type { PromiseLikeOrValue } from 'src/common/types'
import type { WorkerData } from '../types'

export type WorkerFunctionCallback<CallbackData> = (
  data: WorkerData<CallbackData>,
) => PromiseLikeOrValue<void>
export type WorkerFunctionOptions<Input, CallbackData = never> = {
  data: WorkerData<Input>
  callback?: null | WorkerFunctionCallback<CallbackData>
  abortSignal?: null | IAbortSignalFast
}
export type WorkerFunction<Input, Output, CallbackData = never> = (
  options: WorkerFunctionOptions<Input, CallbackData>,
) => Promise<WorkerData<Output>>

export enum WorkerFunctionRequestType {
  input = 'input',
}

export type WorkerFunctionRequest<Input> = {
  type: WorkerFunctionRequestType.input
  data: Input
}

export enum WorkerFunctionResponseType {
  output = 'output',
  callback = 'callback',
}

export type WorkerFunctionResponse<Output, CallbackData = never> =
  | {
      type: WorkerFunctionResponseType.output
      data: Output
    }
  | {
      type: WorkerFunctionResponseType.callback
      data: CallbackData
    }

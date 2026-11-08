type WorkerErrorText = string

const text: WorkerErrorText = 'test worker error'

throw new Error(text)

// Vite removes this type, so the throw below runs on another line than in this file
type WorkerErrorText = string

const text: WorkerErrorText = 'test worker error'

throw new Error(text)

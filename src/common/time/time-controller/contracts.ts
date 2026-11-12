export interface ITimeController<Handle = any> {
  now(): number
  /**
   * Auto-incrementing timestamp
   * @return a value greater than now() and than the previous nowUnique() by at least 1
   */
  nowUnique(): number
  setTimeout(handler: () => void, timeout: number): Handle
  clearTimeout(handle: Handle): void
}

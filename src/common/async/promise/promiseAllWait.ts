/**
 * Like Promise.all, but settles after all promises settle,
 * and rejects with the reason of the first rejected promise in the order of the array
 */
export async function promiseAllWait<T extends readonly unknown[] | []>(
  promises: T,
): Promise<{ -readonly [P in keyof T]: Awaited<T[P]> }> {
  const states = await Promise.allSettled(promises)
  const results: any[] = []
  for (let i = 0, len = states.length; i < len; i++) {
    const state = states[i]
    if (state.status === 'fulfilled') {
      results.push(state.value)
    } else {
      throw state.reason
    }
  }
  return results as any
}

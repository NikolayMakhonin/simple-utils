// Generates IDs unique within a single process/page lifetime.
// Used as requestId (to correlate responses with requests)
// and connectionId (to identify intermediary connections in the route).
// No cryptographic strength needed - just collision avoidance
// between concurrent workers generating IDs in the same process.
// The random prefix distinguishes IDs from different threads/workers
// since each thread gets its own module instance with its own counter.

const ID_PREFIX = Math.random().toString(36).slice(2) + '_'
let nextId = 1

export function getNextId() {
  return ID_PREFIX + nextId++
}

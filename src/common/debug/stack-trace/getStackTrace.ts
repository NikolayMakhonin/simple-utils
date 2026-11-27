// TODO: write doc comments
export function getStackTrace(): string {
  const stack = new Error().stack
  if (stack == null) {
    return ''
  }
  // V8 writes a line of the error before frames like "    at ...".
  // Firefox and Safari write only the frames.
  // The first frame is getStackTrace itself, so the result starts with its caller
  const frameStart =
    stack.indexOf(FRAME_PREFIX_V8) >= 0 ? stack.indexOf('\n') + 1 : 0
  const frameEnd = stack.indexOf('\n', frameStart)
  return frameEnd < 0 ? '' : stack.substring(frameEnd + 1)
}

const FRAME_PREFIX_V8 = '\n    at '

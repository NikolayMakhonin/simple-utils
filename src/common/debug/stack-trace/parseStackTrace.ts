// TODO: write doc comments
export type StackFrame = {
  func: string | undefined | null
  file: string | undefined | null
  line: number | undefined | null
  column: number | undefined | null
}

// TODO: write doc comments
/** @deprecated Пока не ясно нужно ли это */
export function parseStackTrace(
  stackTrace: string,
  maxFrames?: null | number,
): StackFrame[] {
  const regexp =
    /^[ \t]*at(?: (?<name1>[^(]+?)(?::(?<line1>\d+))?(?::(?<column1>\d+))?)?(?: \((?:(?<name2>[^)]+?)(?::(?<line2>\d+))?(?::(?<column2>\d+))?)?\))? *$/gm

  const frames: StackFrame[] = []

  let match: RegExpExecArray | null
  while (
    (maxFrames == null || frames.length < maxFrames) &&
    (match = regexp.exec(stackTrace)) != null
  ) {
    const { name1, line1, column1, name2, line2, column2 } = match.groups!

    const line = line1 || line2
    const column = column1 || column2
    const func = !line1 && name1 ? name1 : void 0
    const file = name2 || (func == null ? name1 : void 0)

    frames.push({
      func: func || void 0,
      file: file || void 0,
      line: (line && parseInt(line, 10)) || void 0,
      column: (column && parseInt(column, 10)) || void 0,
    })
  }

  return frames
}

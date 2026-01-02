/** Normalize path by replacing backslashes with forward slashes */
export function pathNormalize(filePath: string): string {
  return filePath.replace(/\\/g, '/')
}

// TODO: write doc comments
export function globGitIgnoreToPicomatch(glob: string): string {
  const negative = glob.startsWith('!')
  if (negative) {
    glob = glob.substring(1)
  }
  // Convert glob from .gitignore to picomatch format
  // Because AI agents understands picomatch format better
  if (glob.startsWith('/')) {
    glob = glob.substring(1)
  } else if (!glob.startsWith('**') && !glob.startsWith('../')) {
    glob = `**/${glob}`
  }
  if (negative) {
    glob = '!' + glob
  }
  return glob
}

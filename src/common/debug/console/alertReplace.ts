export type Alert = typeof alert

// TODO: write doc comments
export function alertReplace(
  handler: (alert: Alert, message: any) => void,
): () => void {
  const alertOrig = alert

  window.alert = (message: any) => handler(alertOrig, message)

  return () => {
    window.alert = alertOrig
  }
}

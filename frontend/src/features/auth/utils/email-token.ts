// Capture before React/router initialization. Tokens never enter Redux or query strings.
let captured: { path: string; token: string } | undefined
export function captureEmailToken() {
  if (!['/verify-email', '/reset-password'].includes(window.location.pathname))
    return
  const token = new URLSearchParams(window.location.hash.slice(1)).get('token')
  if (!token) return
  captured = { path: window.location.pathname, token }
  window.history.replaceState(
    window.history.state,
    '',
    window.location.pathname + window.location.search,
  )
}
export function emailToken(path: string) {
  return captured?.path === path ? captured.token : ''
}
export function forgetEmailToken() {
  captured = undefined
}

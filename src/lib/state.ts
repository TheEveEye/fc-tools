export type LinkSelection = {
  enabled: boolean
  shipsText: string
  mindlink: boolean
}

export type AppState = {
  selections: Record<string, LinkSelection>
}

function base64EncodeUtf8(input: string): string {
  const bytes = new TextEncoder().encode(input)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

function base64DecodeUtf8(input: string): string {
  const binary = atob(input)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

export function encodeStateToHash(state: AppState): string {
  return encodeURIComponent(base64EncodeUtf8(JSON.stringify(state)))
}

export function decodeStateFromHash(hash: string): AppState | null {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash
  if (!raw) return null
  try {
    const json = base64DecodeUtf8(decodeURIComponent(raw))
    return JSON.parse(json) as AppState
  } catch {
    return null
  }
}

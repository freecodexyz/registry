export type AuthSession = {
  ok?: true;
  address: `0x${string}`;
}

export class SignInVerifyError extends Error {
  constructor(message = 'sign-in failed') {
    super(message)
    this.name = 'SignInVerifyError'
  }
}

function isHexAddress(value: unknown): value is `0x${string}` {
  return typeof value === 'string' && value.startsWith('0x')
}

function readNonce(value: unknown) {
  if (
    typeof value === 'object' &&
    value !== null &&
    'nonce' in value &&
    typeof value.nonce === 'string' &&
    value.nonce.length > 0
  ) {
    return value.nonce
  }

  throw new Error('nonce missing')
}

export function parseAuthSession(value: unknown): AuthSession {
  if (
    typeof value === 'object' &&
    value !== null &&
    'address' in value &&
    isHexAddress(value.address)
  ) {
    return { address: value.address }
  }

  throw new Error('invalid auth session response')
}

export async function loadAuthSession(signal: AbortSignal) {
  const response = await fetch('/api/auth/me', {
    credentials: 'include',
    signal,
  })

  if (response.status === 401) return null
  if (!response.ok) throw new Error('session check failed')

  return parseAuthSession(await response.json() as unknown)
}

export async function loadSignInNonce(address: `0x${string}`, signal?: AbortSignal) {
  const requestInit: RequestInit = { credentials: 'include' }
  if (signal) requestInit.signal = signal

  const response = await fetch(
    `/api/auth/nonce?address=${encodeURIComponent(address)}`,
    requestInit,
  )
  if (!response.ok) throw new Error('nonce request failed')

  return readNonce(await response.json() as unknown)
}

export async function verifySignInMessage(args: { message: string; signature: `0x${string}` }) {
  const response = await fetch('/api/auth/verify', {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(args),
  })

  if (!response.ok) throw new SignInVerifyError()

  return parseAuthSession(await response.json() as unknown)
}

export async function destroyAuthSession() {
  const response = await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include',
  })
  if (!response.ok) throw new Error('logout failed')
}

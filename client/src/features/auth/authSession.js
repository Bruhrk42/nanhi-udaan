const guestCookieName = 'nu_guest_preview'
const unavailableMessage = 'Could not reach the Nanhi Udaan service. Start it with npm run dev:server and check your .env configuration.'

export async function authRequest(path, options = {}) {
  let response
  try {
    response = await fetch(path, {
      credentials: 'include',
      ...options,
    })
  } catch (error) {
    if (error instanceof TypeError) throw new Error(unavailableMessage)
    throw error
  }

  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error(response.ok
      ? 'The authentication service returned an unexpected response.'
      : unavailableMessage)
  }

  let result
  try {
    result = await response.json()
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error(unavailableMessage)
    throw error
  }

  if (!response.ok) {
    const requestError = new Error(result.error || 'Unable to complete the authentication request.')
    requestError.status = response.status
    throw requestError
  }
  return result
}

export function hasGuestPreview() {
  return document.cookie
    .split('; ')
    .some((cookie) => cookie === `${guestCookieName}=1`)
}

export function startGuestPreview() {
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${guestCookieName}=1; Path=/; SameSite=Lax${secure}`
}

export function endGuestPreview() {
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${guestCookieName}=; Path=/; Max-Age=0; SameSite=Lax${secure}`
}

export async function getCurrentUser() {
  let result
  try {
    result = await authRequest('/api/auth/me')
  } catch (error) {
    if (error.status === 401) return null
    throw error
  }
  return result.user
}

export async function signOut() {
  await authRequest('/api/auth/logout', {
    method: 'POST',
  })
}

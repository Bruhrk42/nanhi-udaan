import { useEffect, useState } from 'react'
import ExhibitionPage from './features/exhibition/ExhibitionPage.jsx'
import LoginPage from './features/auth/LoginPage.jsx'
import {
  endGuestPreview,
  hasGuestPreview,
  getCurrentUser,
  signOut,
  startGuestPreview,
} from './features/auth/authSession.js'

function App() {
  const [hasAccess, setHasAccess] = useState(hasGuestPreview)
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    let active = true
    getCurrentUser()
      .then((currentUser) => {
        if (active && currentUser) {
          setHasAccess(true)
        }
      })
      .catch((error) => console.error('Unable to restore the sign-in session:', error))
      .finally(() => {
        if (active) setCheckingSession(false)
      })

    return () => {
      active = false
    }
  }, [])

  function returnToLogin() {
    signOut().catch((error) => console.error('Unable to sign out:', error))
    endGuestPreview()
    setHasAccess(false)
  }

  if (checkingSession && !hasAccess) {
    return <main className="auth-loading" aria-label="Checking your sign-in session" />
  }

  if (!hasAccess) {
    return <LoginPage onExploreAsGuest={() => {
      startGuestPreview()
      setHasAccess(true)
    }} onSignIn={() => {
      setHasAccess(true)
    }} />
  }

  return <ExhibitionPage onReturnToLogin={returnToLogin} />
}

export default App

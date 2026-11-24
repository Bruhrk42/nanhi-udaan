import { useEffect, useRef, useState } from 'react'
import { authRequest } from './authSession.js'
import './login.css'

async function postAuth(path, payload) {
  return authRequest(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

function LoginPage({ onExploreAsGuest, onSignIn }) {
  const [mode, setMode] = useState('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [googleReady, setGoogleReady] = useState(false)
  const [googleMessage, setGoogleMessage] = useState('')
  const googleButtonRef = useRef(null)

  function resetFlow() {
    setError('')
  }

  function changeMode(nextMode) {
    setMode(nextMode)
    resetFlow()
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')

    try {
      const result = await postAuth(
        mode === 'signup' ? '/api/auth/register' : '/api/auth/login',
        mode === 'signup' ? { name, email, password } : { email, password },
      )
      onSignIn(result.user)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    let active = true
    let script

    function showGoogleButton(clientId) {
      if (!active || !googleButtonRef.current || !window.google?.accounts?.id) return

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async ({ credential }) => {
          if (!credential) {
            setError('Google sign-in did not return a credential.')
            return
          }
          setBusy(true)
          setError('')
          try {
            const result = await postAuth('/api/auth/google', { credential })
            onSignIn(result.user)
          } catch (requestError) {
            setError(requestError.message)
          } finally {
            setBusy(false)
          }
        },
      })
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: 'outline',
        size: 'large',
        shape: 'rectangular',
        text: 'continue_with',
        width: Math.min(googleButtonRef.current.clientWidth, 360),
      })
      setGoogleReady(true)
      setGoogleMessage('')
    }

    authRequest('/api/auth/config')
      .then(({ googleClientId }) => {
        if (!active) return
        if (!googleClientId) {
          setGoogleMessage('Set GOOGLE_CLIENT_ID in the root .env to enable Google sign-in.')
          return
        }

        if (window.google?.accounts?.id) {
          showGoogleButton(googleClientId)
          return
        }

        script = document.getElementById('google-identity-services')
        if (!script) {
          script = document.createElement('script')
          script.id = 'google-identity-services'
          script.src = 'https://accounts.google.com/gsi/client'
          script.async = true
          script.defer = true
          document.head.appendChild(script)
        }
        script.addEventListener('load', () => showGoogleButton(googleClientId), { once: true })
        script.addEventListener('error', () => {
          if (active) setGoogleMessage('Google sign-in could not load. Check your internet connection.')
        }, { once: true })
      })
      .catch((requestError) => {
        if (active) setGoogleMessage(requestError.message)
      })

    return () => {
      active = false
    }
  }, [onSignIn])

  return (
    <main className="auth-page">
      <div className="auth-frame">
        <section className="auth-story" aria-labelledby="auth-heading">
          <a className="auth-brand" href="#welcome" aria-label="Nanhi Udaan">
            <span className="auth-brand-mark" aria-hidden="true">✳</span>
            <span>
              <strong>नन्ही उड़ान</strong>
              <small>REKHANKAN · BHOPAL</small>
            </span>
          </a>

          <div className="auth-story-copy">
            <p className="auth-eyebrow"><span aria-hidden="true" /> A little art goes a long way</p>
            <h1 id="auth-heading">
              Come for the art.
              <br />
              Stay for the <em>wonder.</em>
            </h1>
            <p className="auth-story-description">
              Step into a world imagined by young artists. Your next favourite piece is waiting.
            </p>
          </div>

          <div className="auth-artwork">
            <span className="auth-artwork-spark" aria-hidden="true">✳</span>
            <img
              src="/images/exhibition-poster.jpeg"
              alt="Nanhi Udaan painting exhibition poster"
            />
            <p>Little artists. <strong>Big dreams.</strong></p>
          </div>
          <p className="auth-location">BHOPAL, INDIA <span aria-hidden="true">·</span> 19–20 DECEMBER 2026</p>
        </section>

        <section className="auth-panel" aria-labelledby="login-heading">
          <div className="auth-panel-topline">
            <span>{mode === 'signup' ? 'CREATE YOUR ACCOUNT' : 'WELCOME'}</span>
            <span className="auth-panel-spark" aria-hidden="true">✳</span>
          </div>

          <div className="auth-form-wrap">
            <p className="auth-form-kicker">YOUR FRONT-ROW SEAT</p>
            <h2 id="login-heading">
              {mode === 'signup' ? <>Join the<br /><em>inspiration.</em></> : <>Let’s get you<br /><em>in the picture.</em></>}
            </h2>
            <p className="auth-form-intro">
              {mode === 'signup' ? 'Create an account to keep the inspiration close.' : 'Sign in to keep the inspiration close.'}
            </p>

            <div className="auth-mode-switch" aria-label="Account action">
              <button
                aria-pressed={mode === 'login'}
                className={mode === 'login' ? 'is-selected' : ''}
                onClick={() => changeMode('login')}
                type="button"
              >
                Sign in
              </button>
              <button
                aria-pressed={mode === 'signup'}
                className={mode === 'signup' ? 'is-selected' : ''}
                onClick={() => changeMode('signup')}
                type="button"
              >
                Create account
              </button>
            </div>

            <div className="google-sign-in-area">
              <div className={googleReady ? 'google-sign-in is-ready' : 'google-sign-in'} ref={googleButtonRef} />
              {!googleReady && (
                <button
                  className="google-sign-in-fallback"
                  disabled={busy}
                  onClick={() => setError(googleMessage || 'Google sign-in is loading. Please try again.')}
                  type="button"
                >
                  <span className="google-g" aria-hidden="true">G</span>
                  Continue with Google
                  <span className="google-arrow" aria-hidden="true">↗</span>
                </button>
              )}
              {googleMessage && <p className="auth-google-message">{googleMessage}</p>}
            </div>

            <div className="auth-divider"><span>OR USE EMAIL</span></div>

            <form className="auth-form" onSubmit={handleSubmit}>
              {mode === 'signup' && (
                <label>
                  Your name
                  <input
                    autoComplete="name"
                    className="auth-input"
                    maxLength={100}
                    onChange={(event) => setName(event.target.value)}
                    required
                    value={name}
                  />
                </label>
              )}

              <label>
                Email address
                <input
                  autoComplete="email"
                  className="auth-input"
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  type="email"
                  value={email}
                />
              </label>

              <label>
                Password
                <span className="auth-password-input">
                  <input
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                    className="auth-input"
                    id="auth-password"
                    minLength={8}
                    maxLength={72}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                  />
                  <button
                    aria-controls="auth-password"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    className="auth-password-toggle"
                    onClick={() => setShowPassword((isVisible) => !isVisible)}
                    type="button"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </span>
                {mode === 'signup' && <small className="auth-field-hint">Use at least 8 characters.</small>}
              </label>

              <button className="auth-submit" disabled={busy} type="submit">
                {busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}
                <span aria-hidden="true">→</span>
              </button>
            </form>

            <p className="auth-message" aria-live="polite">
              {error}
            </p>

            <div className="auth-guest">
              <span>Just looking around?</span>
              <button type="button" onClick={onExploreAsGuest}>Explore as a guest <span aria-hidden="true">↗</span></button>
            </div>
          </div>

          <p className="auth-legal">
            By continuing, you agree to our <a href="#terms">Terms</a> and <a href="#privacy">Privacy Policy</a>.
          </p>
        </section>
      </div>
    </main>
  )
}

export default LoginPage

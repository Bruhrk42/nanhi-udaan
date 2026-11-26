import { useEffect, useState } from 'react'
import { authRequest, getCurrentUser } from '../auth/authSession.js'
import SiteHeader from './SiteHeader.jsx'
import './my-paintings.css'

function MyPaintingsPage({ onReturnToLogin }) {
  const [user, setUser] = useState(null)
  const [paintings, setPaintings] = useState([])
  const [maxPaintings, setMaxPaintings] = useState(4)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [message, setMessage] = useState('')
  const [removingId, setRemovingId] = useState(null)

  useEffect(() => {
    let active = true
    async function loadDashboard() {
      try {
        const currentUser = await getCurrentUser()
        if (!active) return
        setUser(currentUser)
        if (!currentUser) return

        const result = await authRequest('/api/paintings/mine')
        if (!active) return
        setPaintings(result.paintings)
        setMaxPaintings(result.maxPaintings)
      } catch (requestError) {
        if (active) setError(requestError.message)
      } finally {
        if (active) setLoading(false)
      }
    }

    loadDashboard()
    return () => {
      active = false
    }
  }, [])

  async function takeDownPainting(painting) {
    const confirmed = window.confirm(
      `Take down “${painting.title}”? Its votes will also be removed from the gallery.`,
    )
    if (!confirmed) return

    setRemovingId(painting.id)
    setDeleteError('')
    setError('')
    setMessage('')
    try {
      await authRequest(`/api/paintings/${painting.id}`, { method: 'DELETE' })
      setPaintings((currentPaintings) => currentPaintings
        .filter((currentPainting) => currentPainting.id !== painting.id))
      setMessage(`“${painting.title}” has been taken down.`)
    } catch (requestError) {
      setDeleteError(requestError.message)
    } finally {
      setRemovingId(null)
    }
  }

  const atPaintingLimit = paintings.length >= maxPaintings

  return (
    <>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <div className="page-shell">
        <SiteHeader onReturnToLogin={onReturnToLogin} page="dashboard" />
        <main id="main-content">
          <section className="my-paintings-page" aria-labelledby="my-paintings-heading">
            <div className="content-wrap">
              <a className="my-paintings-back-link" href="/gallery">← Back to the gallery</a>
              <div className="my-paintings-heading">
                <div>
                  <div className="section-label"><span>YOUR STUDIO</span></div>
                  <h1 id="my-paintings-heading">My paintings.</h1>
                  <p>Manage the artwork you have shared with the Nanhi Udaan community.</p>
                </div>
                {user && (
                  <div className="painting-quota" aria-live="polite">
                    <strong>{paintings.length}<span> / {maxPaintings}</span></strong>
                    <span>paintings uploaded</span>
                  </div>
                )}
              </div>

              {user && (
                <div className="my-paintings-actions">
                  <span>Taking down a painting also removes its votes.</span>
                  <a className="my-paintings-upload-link" href="/upload">
                    {atPaintingLimit ? 'Manage your 4 painting slots' : 'Upload a painting'}
                    <span aria-hidden="true">↗</span>
                  </a>
                </div>
              )}

              {deleteError && <p className="my-paintings-message is-error" role="alert">{deleteError}</p>}

              {loading ? (
                <p className="my-paintings-state" role="status">Loading your paintings…</p>
              ) : error ? (
                <p className="my-paintings-state is-error" role="alert">{error}</p>
              ) : !user ? (
                <div className="my-paintings-state my-paintings-sign-in">
                  <h2>Sign in to see your paintings.</h2>
                  <p>This private dashboard only shows artwork uploaded by your account.</p>
                  <button type="button" onClick={onReturnToLogin}>Sign in</button>
                </div>
              ) : (
                <>
                  {message && <p className="my-paintings-message" role="status">{message}</p>}
                  {paintings.length === 0 ? (
                    <div className="my-paintings-state my-paintings-empty">
                      <h2>Your gallery starts here.</h2>
                      <p>You have not uploaded any paintings yet.</p>
                      <a className="my-paintings-upload-link" href="/upload">Upload your first painting <span aria-hidden="true">↗</span></a>
                    </div>
                  ) : (
                    <div className="my-paintings-grid">
                      {paintings.map((painting) => (
                        <article className="my-painting-card" key={painting.id}>
                          <div className="my-painting-image">
                            <img src={painting.imageUrl} alt={painting.title} loading="lazy" />
                          </div>
                          <div className="my-painting-info">
                            <div>
                              <h2>{painting.title}</h2>
                              <p>{painting.voteCount} {painting.voteCount === 1 ? 'vote' : 'votes'}</p>
                            </div>
                            <button
                              className="painting-remove-button"
                              type="button"
                              onClick={() => takeDownPainting(painting)}
                              disabled={removingId !== null}
                              aria-label={`Take down ${painting.title}`}
                            >
                              {removingId === painting.id ? 'Taking down…' : 'Take down'}
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </section>
        </main>
        <footer className="site-footer content-wrap">
          <a className="brand footer-brand" href="/">
            <span className="brand-mark" aria-hidden="true">✳</span>
            <span className="brand-name">
              <strong>नन्ही उड़ान</strong>
              <small>REKHANKAN · BHOPAL</small>
            </span>
          </a>
          <p>Little art. Big dreams. See you there.</p>
          <a className="back-to-top" href="/#top">Back to top ↑</a>
        </footer>
      </div>
    </>
  )
}

export default MyPaintingsPage

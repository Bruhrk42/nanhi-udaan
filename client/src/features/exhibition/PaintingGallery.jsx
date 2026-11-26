import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { authRequest } from '../auth/authSession.js'
import './painting-gallery.css'

function PaintingGallery({ onReturnToLogin }) {
  const [paintings, setPaintings] = useState([])
  const [votedPaintingId, setVotedPaintingId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [galleryError, setGalleryError] = useState('')
  const [selectedPainting, setSelectedPainting] = useState(null)
  const [voteBusy, setVoteBusy] = useState(false)
  const [voteMessage, setVoteMessage] = useState('')
  const [voteError, setVoteError] = useState('')
  const [signInRequired, setSignInRequired] = useState(false)
  const dialogRef = useRef(null)
  const selectedTrigger = useRef(null)

  const loadPaintings = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true)
    setGalleryError('')
    try {
      const result = await authRequest('/api/paintings')
      setPaintings(result.paintings)
      setVotedPaintingId(result.votedPaintingId)
    } catch (error) {
      setGalleryError(error.message)
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    authRequest('/api/paintings')
      .then((result) => {
        if (!active) return
        setPaintings(result.paintings)
        setVotedPaintingId(result.votedPaintingId)
      })
      .catch((error) => {
        if (active) setGalleryError(error.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!selectedPainting) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialogRef.current?.focus()

    function handleDialogKeyDown(event) {
      if (event.key === 'Escape') {
        setSelectedPainting(null)
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return

      const focusable = dialogRef.current.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }

    window.addEventListener('keydown', handleDialogKeyDown)
    return () => {
      window.removeEventListener('keydown', handleDialogKeyDown)
      document.body.style.overflow = previousOverflow
      selectedTrigger.current?.focus()
    }
  }, [selectedPainting])

  function openPainting(painting, event) {
    selectedTrigger.current = event.currentTarget
    setVoteMessage('')
    setVoteError('')
    setSignInRequired(false)
    setSelectedPainting(painting)
  }

  async function handleVote() {
    if (!selectedPainting || voteBusy) return
    setVoteBusy(true)
    setVoteMessage('')
    setVoteError('')
    setSignInRequired(false)

    try {
      const result = await authRequest(`/api/paintings/${selectedPainting.id}/votes`, {
        method: 'POST',
      })
      setVotedPaintingId(result.votedPaintingId)
      setVoteMessage(result.message)
      await loadPaintings(false)
    } catch (error) {
      if (error.status === 401) {
        setSignInRequired(true)
        setVoteError('Please sign in to cast your vote.')
      } else if (error.status === 409) {
        setVoteMessage(error.message)
        await loadPaintings(false)
      } else {
        setVoteError(error.message)
      }
    } finally {
      setVoteBusy(false)
    }
  }

  const votedPainting = paintings.find((painting) => painting.id === votedPaintingId)

  return (
    <>
      <section className="gallery-section" id="gallery" aria-labelledby="gallery-heading">
        <div className="content-wrap">
          <div className="gallery-heading">
            <div>
              <div className="section-label"><span>03</span> THE COMMUNITY GALLERY</div>
              <h2 id="gallery-heading">Little canvases.<br /><em>Big imagination.</em></h2>
            </div>
            <p>Meet the young artists through the worlds they have painted. Open a piece to take a closer look and cast your vote.</p>
          </div>

          <a className="gallery-upload-link" href="/upload">
            Have a painting to share? <strong>Upload it here <span aria-hidden="true">↗</span></strong>
          </a>

          {loading ? (
            <p className="gallery-state" role="status">Gathering the paintings…</p>
          ) : galleryError ? (
            <div className="gallery-state gallery-state-error" role="alert">
              <p>{galleryError}</p>
              <button type="button" onClick={() => loadPaintings()}>Try again</button>
            </div>
          ) : paintings.length === 0 ? (
            <div className="gallery-state gallery-empty">
              <span aria-hidden="true">✳</span>
              <h3>The first canvas is waiting.</h3>
              <p>{authenticated
                ? 'Be the first to share a painting with the Nanhi Udaan community.'
                : 'The gallery is ready for its first painting. Come back soon to meet our young artists.'}</p>
            </div>
          ) : (
            <div className="painting-grid">
              {paintings.map((painting) => (
                <article className="painting-card" key={painting.id}>
                  <button
                    className="painting-card-open"
                    type="button"
                    onClick={(event) => openPainting(painting, event)}
                    aria-label={`View ${painting.title}, by ${painting.artistName}`}
                  >
                    <span className="painting-card-title">{painting.title}</span>
                    <span className="painting-card-image">
                      <img src={painting.imageUrl} alt="" loading="lazy" />
                      <span className="painting-view-hint">Take a closer look <span aria-hidden="true">↗</span></span>
                    </span>
                    <span className="painting-card-artist">
                      <span>BY</span>
                      <strong>{painting.artistName}</strong>
                      <span className="painting-vote-count">{painting.voteCount} {painting.voteCount === 1 ? 'vote' : 'votes'}</span>
                    </span>
                  </button>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {selectedPainting && createPortal(
        <div
          className="painting-lightbox"
          onClick={(event) => {
            if (event.target === event.currentTarget) setSelectedPainting(null)
          }}
        >
          <div
            className="painting-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="painting-dialog-title"
            tabIndex="-1"
            ref={dialogRef}
          >
            <button
              className="painting-dialog-close"
              type="button"
              onClick={() => setSelectedPainting(null)}
              aria-label="Close painting view"
            >
              <span aria-hidden="true">×</span>
            </button>
            <div className="painting-dialog-image">
              <img src={selectedPainting.imageUrl} alt={selectedPainting.title} />
            </div>
            <div className="painting-dialog-info">
              <p className="painting-dialog-byline">A NANHI UDAAN ORIGINAL</p>
              <h2 id="painting-dialog-title">{selectedPainting.title}</h2>
              <p className="painting-dialog-artist">By {selectedPainting.artistName}</p>
              {votedPaintingId ? (
                <div className="painting-vote-status" role="status">
                  {votedPaintingId === selectedPainting.id
                    ? (voteMessage || 'Your vote is recorded for this painting.')
                    : `You have already voted${votedPainting ? ` for “${votedPainting.title}”` : ''}.`}
                </div>
              ) : voteMessage ? (
                <div className="painting-vote-status" role="status">{voteMessage}</div>
              ) : (
                <button
                  className="painting-vote-button"
                  type="button"
                  onClick={handleVote}
                  disabled={voteBusy}
                >
                  {voteBusy ? 'Recording your vote…' : 'Vote Now'}
                  <span aria-hidden="true">✳</span>
                </button>
              )}
              {voteError && (
                <p className="gallery-feedback is-error" role="alert">
                  {voteError}
                  {signInRequired && (
                    <> <button type="button" onClick={onReturnToLogin}>Sign in</button></>
                  )}
                </p>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}

export default PaintingGallery

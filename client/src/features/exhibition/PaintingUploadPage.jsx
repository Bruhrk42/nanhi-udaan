import { useEffect, useState } from 'react'
import { getCurrentUser, authRequest } from '../auth/authSession.js'
import SiteHeader from './SiteHeader.jsx'
import './painting-upload.css'

function readImageAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => resolve(reader.result))
    reader.addEventListener('error', () => reject(new Error('The image could not be read. Please choose another file.')))
    reader.readAsDataURL(file)
  })
}

function PaintingUploadPage({ onReturnToLogin }) {
  const [user, setUser] = useState(null)
  const [checkingUser, setCheckingUser] = useState(true)
  const [authError, setAuthError] = useState('')
  const [paintingCount, setPaintingCount] = useState(0)
  const [maxPaintings, setMaxPaintings] = useState(4)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [submittedTitle, setSubmittedTitle] = useState('')

  useEffect(() => {
    let active = true
    getCurrentUser()
      .then(async (currentUser) => {
        if (!active) return
        setUser(currentUser)
        if (!currentUser) return

        const result = await authRequest('/api/paintings/mine')
        if (active) {
          setPaintingCount(result.paintings.length)
          setMaxPaintings(result.maxPaintings)
        }
      })
      .catch((error) => {
        if (active) setAuthError(error.message)
      })
      .finally(() => {
        if (active) setCheckingUser(false)
      })

    return () => {
      active = false
    }
  }, [])

  async function handleSubmit(event) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    const title = formData.get('title').trim()
    const image = formData.get('image')

    if (!(image instanceof File) || image.size === 0) {
      setUploadError('Choose a painting image to upload.')
      return
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(image.type)) {
      setUploadError('Upload a PNG, JPEG, or WebP image.')
      return
    }
    if (image.size > 5 * 1024 * 1024) {
      setUploadError('Painting images must be no larger than 5 MB.')
      return
    }

    setUploading(true)
    setUploadError('')
    setSubmittedTitle('')
    try {
      const imageData = await readImageAsDataUrl(image)
      await authRequest('/api/paintings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, imageData }),
      })
      setSubmittedTitle(title)
      setPaintingCount((count) => count + 1)
      form.reset()
    } catch (error) {
      setUploadError(error.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <div className="page-shell">
        <SiteHeader onReturnToLogin={onReturnToLogin} page="upload" />
        <main id="main-content">
          <section className="painting-upload-page" aria-labelledby="painting-upload-heading">
            <div className="content-wrap">
              <a className="upload-back-link" href="/gallery">← Back to the gallery</a>
              <div className="painting-upload-layout">
                <div className="painting-upload-intro">
                  <div className="section-label"><span>SHARE YOUR WORK</span></div>
                  <h1 id="painting-upload-heading">Give your art<br /><em>a place to shine.</em></h1>
                  <p>
                    Add your painting to the Nanhi Udaan community gallery. Share its title and a clear photo so everyone can enjoy your work.
                  </p>
                  <div className="upload-guidelines">
                    <span aria-hidden="true">✳</span>
                    <p>Use an image you have permission to share. PNG, JPEG, or WebP files up to 5 MB are welcome.</p>
                  </div>
                </div>

                <div className="painting-upload-panel">
                  {checkingUser ? (
                    <p className="upload-page-status" role="status">Checking your sign-in…</p>
                  ) : authError ? (
                    <p className="upload-page-error" role="alert">{authError}</p>
                  ) : user ? (
                    <>
                      <p className="upload-panel-kicker">YOUR CANVAS</p>
                      <h2>Tell us about it.</h2>
                      <p className="upload-quota" role="status">
                        {paintingCount} of {maxPaintings} paintings uploaded
                      </p>
                      {submittedTitle && (
                        <div className="upload-success" role="status">
                          <strong>{submittedTitle}</strong> is now in the gallery.
                          <a href="/gallery">View the gallery <span aria-hidden="true">↗</span></a>
                        </div>
                      )}
                      {paintingCount >= maxPaintings ? (
                        <div className="upload-limit-message">
                          <p>You’ve reached your {maxPaintings}-painting limit. Take down one of your paintings to make room for another.</p>
                          <a href="/my-paintings">Manage my paintings <span aria-hidden="true">↗</span></a>
                        </div>
                      ) : (
                        <form className="painting-upload-form" onSubmit={handleSubmit}>
                          <label htmlFor="painting-title">Painting title</label>
                          <input
                            id="painting-title"
                            name="title"
                            type="text"
                            maxLength="120"
                            placeholder="Give your painting a name"
                            required
                          />
                          <label htmlFor="painting-image">Painting image</label>
                          <input
                            id="painting-image"
                            name="image"
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            required
                          />
                          <small className="upload-file-note">PNG, JPEG, or WebP · up to 5 MB</small>
                          {uploadError && <p className="upload-page-error" role="alert">{uploadError}</p>}
                          <button className="upload-submit" type="submit" disabled={uploading}>
                            {uploading ? 'Uploading your painting…' : 'Add to the gallery'}
                            <span aria-hidden="true">↗</span>
                          </button>
                        </form>
                      )}
                    </>
                  ) : (
                    <div className="upload-sign-in">
                      <p className="upload-panel-kicker">READY WHEN YOU ARE</p>
                      <h2>Sign in to share your art.</h2>
                      <p>Your painting will be credited to your Nanhi Udaan account.</p>
                      <button className="upload-submit" type="button" onClick={onReturnToLogin}>
                        Sign in to continue <span aria-hidden="true">↗</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
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

export default PaintingUploadPage

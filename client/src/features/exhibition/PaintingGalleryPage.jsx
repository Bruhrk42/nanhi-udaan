import PaintingGallery from './PaintingGallery.jsx'
import SiteHeader from './SiteHeader.jsx'

function PaintingGalleryPage({ onReturnToLogin }) {
  return (
    <>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <div className="page-shell">
        <SiteHeader onReturnToLogin={onReturnToLogin} page="gallery" />
        <main id="main-content">
          <PaintingGallery onReturnToLogin={onReturnToLogin} />
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

export default PaintingGalleryPage

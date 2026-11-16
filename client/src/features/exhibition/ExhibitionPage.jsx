import SiteHeader from './SiteHeader.jsx'
import { benefits, categories, exhibition } from './exhibitionData.js'
import './exhibition.css'

function ArrowLink({ href, children }) {
  return (
    <a className="arrow-link" href={href}>
      {children} <span aria-hidden="true">↗</span>
    </a>
  )
}

function Hero() {
  return (
    <section className="hero" id="top">
      <div className="hero-copy">
        <p className="eyebrow"><span className="eyebrow-dot" /> A celebration of young imagination</p>
        <h1>
          Small hands.
          <br />
          <em>Big</em> <span className="headline-outline">dreams.</span>
        </h1>
        <p className="hero-description">
          One city. A hundred ways to see the world. Come celebrate the artists who are just getting started.
        </p>
        <div className="hero-actions">
          <ArrowLink href="#visit">Explore the exhibition</ArrowLink>
          <a className="quiet-link" href="#categories">Meet the young artists <span aria-hidden="true">↓</span></a>
        </div>
        <div className="hero-footnote">
          <span>BHOPAL, INDIA</span>
          <span>NATIONAL-LEVEL EXHIBITION</span>
        </div>
      </div>

      <div className="hero-art">
        <div className="art-backdrop" aria-hidden="true" />
        <div className="poster-frame">
          <img
            src="/images/exhibition-poster.jpeg"
            alt="Nanhi Udaan painting exhibition poster, featuring a portrait blended with a butterfly wing"
          />
        </div>
      </div>
    </section>
  )
}

function EventStrip() {
  return (
    <div className="event-strip" aria-label="Event summary">
      <span>{exhibition.dates}</span>
      <span className="strip-separator" aria-hidden="true">✳</span>
      <span>{exhibition.venue}, {exhibition.address}</span>
      <span className="strip-separator" aria-hidden="true">✳</span>
      <span>{exhibition.hours}</span>
    </div>
  )
}

function Introduction() {
  return (
    <section className="intro-section" id="about">
      <div className="content-wrap">
        <div className="section-label"><span>01</span> THE IDEA</div>
        <div className="intro-copy">
          <h2>
            Every great artist
            <br />
            starts <em>somewhere.</em>
          </h2>
          <div className="intro-aside">
            <p>
              <strong>{exhibition.name}</strong> is a national-level painting exhibition-cum-sale that gives young artists a real stage to share what they see, make, and imagine.
            </p>
            <p>
              Created by {exhibition.organizer}, this is a place for families, art lovers, and the next generation of makers to meet.
            </p>
            <ArrowLink href="#visit">Get the details</ArrowLink>
          </div>
        </div>
        <div className="intro-stats" aria-label="Event highlights">
          <div><strong>3</strong><span>age-wise categories</span></div>
          <div><strong>2</strong><span>days of creativity</span></div>
          <div><strong>1</strong><span>beautiful community</span></div>
        </div>
      </div>
    </section>
  )
}

function Categories() {
  return (
    <section className="categories-section" id="categories">
      <div className="content-wrap">
        <div className="section-heading">
          <div>
            <div className="section-label"><span>02</span> THE ARTISTS</div>
            <h2>A place for every<br /><em>kind of wonder.</em></h2>
          </div>
          <p>Three age groups. One shared love of making something their own.</p>
        </div>

        <div className="category-grid">
          {categories.map((category) => (
            <article className={`category-card ${category.color}`} key={category.number}>
              <div className="category-topline">
                <span>{category.number} / 03</span>
                <span aria-hidden="true">↗</span>
              </div>
              <div className="category-symbol">
                <img src={category.image} alt="" loading="lazy" />
              </div>
              <div>
                <p className="category-ages">{category.ages}</p>
                <h3>{category.name}</h3>
                <p className="category-note">{category.note}</p>
              </div>
            </article>
          ))}
        </div>

        <div className="specification">
          <span className="spec-icon" aria-hidden="true">✳</span>
          <div>
            <p className="spec-label">MADE BY HAND, MADE TO BE SEEN</p>
            <p>Painted with <strong>{exhibition.medium.toLowerCase()}</strong> · Canvas size <strong>{exhibition.canvasSize}</strong></p>
          </div>
          <span className="spec-arrow" aria-hidden="true">↘</span>
        </div>
      </div>
    </section>
  )
}

function ReasonsToCome() {
  return (
    <section className="benefits-section">
      <div className="content-wrap">
        <div className="section-heading benefits-heading">
          <div>
            <div className="section-label"><span>03</span> WHY IT MATTERS</div>
            <h2>More than an<br /><em>art show.</em></h2>
          </div>
          <p>A first exhibition can open up a whole new world. Here’s what a little encouragement can do.</p>
        </div>

        <ul className="benefit-list">
          {benefits.map((benefit, index) => (
            <li key={benefit}>
              <span className="benefit-index">{String(index + 1).padStart(2, '0')}</span>
              <span>{benefit}</span>
              <span className="benefit-spark" aria-hidden="true">✳</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function VisitSection() {
  return (
    <section className="visit-section" id="visit">
      <div className="visit-inner content-wrap">
        <div className="section-label"><span>04</span> COME BE PART OF IT</div>
        <div className="visit-main">
          <div>
          
            <h2>See you<br /><em>in Bhopal.</em></h2>
          </div>
          <div className="visit-details">
            <div className="visit-date">{exhibition.dates}<span>{exhibition.days}</span></div>
            <div className="visit-info">
              <div><span>WHERE</span><strong>{exhibition.venue}</strong><p>{exhibition.address}</p></div>
              <div><span>WHEN</span><strong>{exhibition.hours}</strong><p>Both days · 19 & 20 December</p></div>
            </div>
            <a className="visit-button" href="https://maps.google.com/?q=Manas+Bhavan+Shyamla+Hills+Bhopal" target="_blank" rel="noreferrer">
              Find your way here <span aria-hidden="true">↗</span>
            </a>
            <p className="visit-note">Bring your curiosity. Bring your people. The art is waiting.</p>
          </div>
        </div>
      </div>
    </section>
  )
}

function SiteFooter() {
  return (
    <footer className="site-footer content-wrap">
      <a className="brand footer-brand" href="#top">
        <span className="brand-mark" aria-hidden="true">✳</span>
        <span className="brand-name">
          <strong>नन्ही उड़ान</strong>
          <small>REKHANKAN · BHOPAL</small>
        </span>
      </a>
      <p>Little art. Big dreams. See you there.</p>
      <a className="back-to-top" href="#top">Back to top ↑</a>
    </footer>
  )
}

function ExhibitionPage() {
  return (
    <>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <div className="page-shell">
        <SiteHeader />
        <main id="main-content">
          <Hero />
          <EventStrip />
          <Introduction />
          <Categories />
          <ReasonsToCome />
          <VisitSection />
        </main>
        <SiteFooter />
      </div>
    </>
  )
}

export default ExhibitionPage

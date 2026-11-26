import { useState } from 'react'

const links = [
  { label: 'The exhibition', href: '#about' },
  { label: 'Categories', href: '#categories' },
  { label: 'Paintings', href: '/gallery' },
  { label: 'My paintings', href: '/my-paintings' },
  { label: 'Plan your visit', href: '#visit' },
]

function SiteHeader({ onReturnToLogin, page = 'home' }) {
  const [menuOpen, setMenuOpen] = useState(false)

  const closeMenu = () => setMenuOpen(false)
  const homeLink = (href) => (href.startsWith('#') && page !== 'home' ? `/${href}` : href)

  return (
    <header className="site-header">
      <a className="brand" href={page === 'home' ? '#top' : '/'} aria-label="Nanhi Udaan home" onClick={closeMenu}>
        <span className="brand-mark" aria-hidden="true">✳</span>
        <span className="brand-name">
          <strong>नन्ही उड़ान</strong>
          <small>REKHANKAN · BHOPAL</small>
        </span>
      </a>

      <button
        className="menu-toggle"
        type="button"
        aria-expanded={menuOpen}
        aria-controls="primary-navigation"
        onClick={() => setMenuOpen((open) => !open)}
      >
        {menuOpen ? 'Close' : 'Menu'}
        <span aria-hidden="true">{menuOpen ? '−' : '+'}</span>
      </button>

      <nav
        className={`primary-navigation${menuOpen ? ' is-open' : ''}`}
        id="primary-navigation"
        aria-label="Primary navigation"
      >
        {links.map((link) => (
          <a key={link.href} href={homeLink(link.href)} onClick={closeMenu}>
            {link.label}
          </a>
        ))}
        <a className="nav-cta" href="/upload" onClick={closeMenu}>
          Upload a painting <span aria-hidden="true">↗</span>
        </a>
        <button className="nav-login" type="button" onClick={onReturnToLogin}>
          Back to sign in <span aria-hidden="true">↗</span>
        </button>
      </nav>
    </header>
  )
}

export default SiteHeader

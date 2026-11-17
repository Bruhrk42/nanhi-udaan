import { useState } from 'react'
import EyeIcon from './EyeIcon.jsx'

const links = [
  { label: 'The exhibition', href: '#about' },
  { label: 'Categories', href: '#categories' },
  { label: 'Plan your visit', href: '#visit' },
]

function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false)

  const closeMenu = () => setMenuOpen(false)

  return (
    <header className="site-header">
      <a className="brand" href="#top" aria-label="Nanhi Udaan home" onClick={closeMenu}>
        <span className="brand-mark"><EyeIcon /></span>
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
          <a key={link.href} href={link.href} onClick={closeMenu}>
            {link.label}
          </a>
        ))}
        <a className="nav-cta" href="#visit" onClick={closeMenu}>
          See you there <span aria-hidden="true">↗</span>
        </a>
      </nav>
    </header>
  )
}

export default SiteHeader

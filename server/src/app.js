import bcrypt from 'bcryptjs'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import { randomUUID } from 'node:crypto'
import express from 'express'
import { rateLimit } from 'express-rate-limit'
import helmet from 'helmet'
import jwt from 'jsonwebtoken'
import { OAuth2Client } from 'google-auth-library'

const SESSION_COOKIE = 'na_session'
const SESSION_DURATION_SECONDS = 7 * 24 * 60 * 60
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('nanhi-udaan-invalid-login', 12)

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
  }
}

function sendError(res, status, message) {
  return res.status(status).json({ error: message })
}

export function createApp({
  db,
  jwtSecret,
  googleClientId = '',
  googleAuthClient,
  allowedOrigins = ['http://localhost:5173'],
  production = false,
}) {
  const app = express()
  const origins = new Set(allowedOrigins)
  const googleClient = googleAuthClient || new OAuth2Client(googleClientId)

  app.disable('x-powered-by')
  app.use(helmet())
  app.use(cors({
    credentials: true,
    origin(origin, callback) {
      return callback(null, !origin || origins.has(origin))
    },
  }))
  app.use(express.json({ limit: '16kb' }))
  app.use((req, _res, next) => {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      req.body = {}
    }
    return next()
  })
  app.use(cookieParser())
  app.use((req, res, next) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      const origin = req.get('origin')
      const fetchSite = req.get('sec-fetch-site')
      if ((origin && !origins.has(origin)) || fetchSite === 'cross-site') {
        return sendError(res, 403, 'Request origin is not allowed.')
      }
    }
    return next()
  })

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many authentication attempts. Try again later.' },
  })
  function setSessionCookie(res, user) {
    const sessionId = randomUUID()
    const expiresAt = Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS
    db.prepare('DELETE FROM sessions WHERE expires_at <= ? OR revoked_at IS NOT NULL')
      .run(Math.floor(Date.now() / 1000))
    db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
      .run(sessionId, user.id, expiresAt)
    const token = jwt.sign({ sub: String(user.id), jti: sessionId }, jwtSecret, {
      expiresIn: SESSION_DURATION_SECONDS,
      issuer: 'nanhi-udaan',
      audience: 'nanhi-udaan-web',
    })
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: production,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_DURATION_SECONDS * 1000,
    })
  }

  function requireSession(req, res, next) {
    const token = req.cookies[SESSION_COOKIE]
    if (!token) return sendError(res, 401, 'Please sign in.')

    let claims
    try {
      claims = jwt.verify(token, jwtSecret, {
        issuer: 'nanhi-udaan',
        audience: 'nanhi-udaan-web',
      })
    } catch {
      return sendError(res, 401, 'Please sign in.')
    }

    try {
      const user = db.prepare(`
        SELECT users.id, users.name, users.email
        FROM sessions
        JOIN users ON users.id = sessions.user_id
        WHERE sessions.id = ? AND sessions.user_id = ? AND sessions.revoked_at IS NULL
          AND sessions.expires_at > ?
      `).get(claims.jti, Number(claims.sub), Math.floor(Date.now() / 1000))
      if (!user) return sendError(res, 401, 'Please sign in.')
      req.user = user
      req.sessionId = claims.jti
      return next()
    } catch (error) {
      return next(error)
    }
  }

  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))
  app.get('/api/auth/config', (_req, res) => {
    res.json({ googleClientId: googleClientId || null })
  })

  app.post('/api/auth/register', authLimiter, async (req, res, next) => {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : ''
    const email = normalizeEmail(req.body.email)
    const password = req.body.password
    if (!name || name.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return sendError(res, 400, 'Enter a valid name and email address.')
    }
    if (typeof password !== 'string' || Buffer.byteLength(password, 'utf8') < 8
      || Buffer.byteLength(password, 'utf8') > 72) {
      return sendError(res, 400, 'Password must be between 8 and 72 bytes.')
    }

    try {
      const passwordHash = await bcrypt.hash(password, 12)
      const result = db.prepare(`
        INSERT INTO users (name, email, password_hash)
        VALUES (?, ?, ?)
      `).run(name, email, passwordHash)
      const user = db.prepare('SELECT id, name, email FROM users WHERE id = ?')
        .get(result.lastInsertRowid)
      setSessionCookie(res, user)
      return res.status(201).json({ user: publicUser(user) })
    } catch (error) {
      if (error.status) return sendError(res, error.status, error.message)
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return sendError(res, 409, 'An account with this email already exists.')
      }
      return next(error)
    }
  })

  app.post('/api/auth/login', authLimiter, async (req, res, next) => {
    const email = normalizeEmail(req.body.email)
    const password = req.body.password
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || typeof password !== 'string'
      || Buffer.byteLength(password, 'utf8') > 72) {
      return sendError(res, 400, 'Enter a valid email address and password.')
    }

    try {
      const user = db.prepare(`
        SELECT id, name, email, password_hash, email_verified_at
        FROM users WHERE email = ?
      `).get(email)
      const passwordMatches = await bcrypt.compare(password, user?.password_hash || DUMMY_PASSWORD_HASH)
      if (!passwordMatches) {
        return sendError(res, 401, 'Email or password is incorrect.')
      }
      setSessionCookie(res, user)
      return res.json({ user: publicUser(user) })
    } catch (error) {
      return next(error)
    }
  })

  app.post('/api/auth/google', authLimiter, async (req, res, next) => {
    if (!googleClientId) {
      return sendError(res, 503, 'Google sign-in is not configured.')
    }

    const credential = typeof req.body.credential === 'string' ? req.body.credential : ''
    if (!credential) return sendError(res, 400, 'Google sign-in did not provide a credential.')

    let payload
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: googleClientId,
      })
      payload = ticket.getPayload()
    } catch {
      return sendError(res, 401, 'Google sign-in could not be verified. Please try again.')
    }

    const email = normalizeEmail(payload?.email)
    if (!email || payload.email_verified !== true) {
      return sendError(res, 401, 'Use a Google account with a verified email address.')
    }

    try {
      const name = typeof payload.name === 'string' ? payload.name.trim().slice(0, 100) : ''
      const verifiedAt = new Date().toISOString()
      const user = db.transaction(() => {
        db.prepare(`
          INSERT INTO users (name, email, email_verified_at)
          VALUES (?, ?, ?)
          ON CONFLICT(email) DO UPDATE SET
            email_verified_at = COALESCE(users.email_verified_at, excluded.email_verified_at),
            name = CASE WHEN users.name = '' THEN excluded.name ELSE users.name END
        `).run(name, email, verifiedAt)
        return db.prepare('SELECT id, name, email FROM users WHERE email = ?').get(email)
      })()
      setSessionCookie(res, user)
      return res.json({ user: publicUser(user) })
    } catch (error) {
      return next(error)
    }
  })

  app.get('/api/auth/me', requireSession, (req, res) => {
    res.json({ user: publicUser(req.user) })
  })

  app.post('/api/auth/logout', (req, res) => {
    const token = req.cookies[SESSION_COOKIE]
    if (token) {
      try {
        const claims = jwt.verify(token, jwtSecret, {
          issuer: 'nanhi-udaan',
          audience: 'nanhi-udaan-web',
        })
        db.prepare("UPDATE sessions SET revoked_at = datetime('now') WHERE id = ?")
          .run(claims.jti)
      } catch {
        // Expired or malformed cookies are cleared below.
      }
    }
    res.clearCookie(SESSION_COOKIE, {
      httpOnly: true,
      secure: production,
      sameSite: 'lax',
      path: '/',
    })
    return res.json({ message: 'Signed out.' })
  })

  app.use((req, res) => sendError(res, 404, 'Not found.'))
  app.use((error, _req, res, _next) => {
    if (res.headersSent) return
    if (error.type === 'entity.too.large') {
      return sendError(res, 413, 'Request body is too large.')
    }
    if (error.type === 'entity.parse.failed') {
      return sendError(res, 400, 'Request body must be valid JSON.')
    }
    console.error('Unhandled API error:', error)
    return sendError(res, 500, 'Something went wrong. Please try again.')
  })

  return app
}

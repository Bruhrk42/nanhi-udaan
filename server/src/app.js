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
const MAX_PAINTING_IMAGE_BYTES = 5 * 1024 * 1024
const MAX_PAINTINGS_PER_USER = 4
const PAINTING_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

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

function parsePaintingImage(value) {
  if (typeof value !== 'string') {
    return { error: 'Choose a painting image to upload.' }
  }

  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value)
  if (!match || !PAINTING_IMAGE_TYPES.has(match[1])) {
    return { error: 'Upload a PNG, JPEG, or WebP image.' }
  }

  const imageData = Buffer.from(match[2], 'base64')
  if (imageData.length === 0 || imageData.length > MAX_PAINTING_IMAGE_BYTES
    || imageData.toString('base64') !== match[2]) {
    return { error: 'Painting images must be no larger than 5 MB.' }
  }

  const isPng = match[1] === 'image/png'
    && imageData.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  const isJpeg = match[1] === 'image/jpeg'
    && imageData[0] === 0xff && imageData[1] === 0xd8 && imageData[2] === 0xff
  const isWebp = match[1] === 'image/webp'
    && imageData.toString('ascii', 0, 4) === 'RIFF'
    && imageData.toString('ascii', 8, 12) === 'WEBP'

  if (!isPng && !isJpeg && !isWebp) {
    return { error: 'The selected file is not a valid PNG, JPEG, or WebP image.' }
  }

  return { imageData, imageMimeType: match[1] }
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
  const standardJsonBodyParser = express.json({ limit: '16kb' })
  const paintingUploadBodyParser = express.json({ limit: '7mb' })

  app.disable('x-powered-by')
  app.use(helmet())
  app.use(cors({
    credentials: true,
    origin(origin, callback) {
      return callback(null, !origin || origins.has(origin))
    },
  }))
  app.use((req, res, next) => {
    const bodyParser = req.method === 'POST' && req.path === '/api/paintings'
      ? paintingUploadBodyParser
      : standardJsonBodyParser
    return bodyParser(req, res, next)
  })
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

  function getSessionUser(req) {
    const token = req.cookies[SESSION_COOKIE]
    if (!token) return null

    let claims
    try {
      claims = jwt.verify(token, jwtSecret, {
        issuer: 'nanhi-udaan',
        audience: 'nanhi-udaan-web',
      })
    } catch {
      return null
    }

    return db.prepare(`
      SELECT users.id, users.name, users.email
      FROM sessions
      JOIN users ON users.id = sessions.user_id
      WHERE sessions.id = ? AND sessions.user_id = ? AND sessions.revoked_at IS NULL
        AND sessions.expires_at > ?
    `).get(claims.jti, Number(claims.sub), Math.floor(Date.now() / 1000)) || null
  }

  function optionalSession(req, _res, next) {
    try {
      req.user = getSessionUser(req)
      return next()
    } catch (error) {
      return next(error)
    }
  }

  function requireSession(req, res, next) {
    try {
      const user = getSessionUser(req)
      if (!user) return sendError(res, 401, 'Please sign in.')
      req.user = user
      return next()
    } catch (error) {
      return next(error)
    }
  }

  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))
  app.get('/api/auth/config', (_req, res) => {
    res.json({ googleClientId: googleClientId || null })
  })

  app.get('/api/paintings', optionalSession, (req, res, next) => {
    try {
      const paintings = db.prepare(`
        SELECT paintings.id, paintings.title,
          CASE WHEN trim(users.name) = '' THEN 'Nanhi Udaan artist' ELSE users.name END AS artistName,
          paintings.created_at AS createdAt,
          (SELECT COUNT(*) FROM painting_votes WHERE painting_id = paintings.id) AS voteCount
        FROM paintings
        JOIN users ON users.id = paintings.user_id
        ORDER BY paintings.created_at DESC, paintings.id DESC
      `).all()
      const vote = req.user
        ? db.prepare('SELECT painting_id FROM painting_votes WHERE user_id = ?').get(req.user.id)
        : null
      const votedPaintingId = vote?.painting_id ?? null

      return res.json({
        authenticated: Boolean(req.user),
        votedPaintingId,
        paintings: paintings.map((painting) => ({
          ...painting,
          imageUrl: `/api/paintings/${painting.id}/image`,
          hasVoted: painting.id === votedPaintingId,
        })),
      })
    } catch (error) {
      return next(error)
    }
  })

  app.get('/api/paintings/mine', requireSession, (req, res, next) => {
    try {
      const paintings = db.prepare(`
        SELECT paintings.id, paintings.title,
          CASE WHEN trim(users.name) = '' THEN 'Nanhi Udaan artist' ELSE users.name END AS artistName,
          paintings.created_at AS createdAt,
          (SELECT COUNT(*) FROM painting_votes WHERE painting_id = paintings.id) AS voteCount
        FROM paintings
        JOIN users ON users.id = paintings.user_id
        WHERE paintings.user_id = ?
        ORDER BY paintings.created_at DESC, paintings.id DESC
      `).all(req.user.id)

      return res.json({
        paintings: paintings.map((painting) => ({
          ...painting,
          imageUrl: `/api/paintings/${painting.id}/image`,
        })),
        maxPaintings: MAX_PAINTINGS_PER_USER,
      })
    } catch (error) {
      return next(error)
    }
  })

  app.get('/api/paintings/:id/image', (req, res, next) => {
    const paintingId = Number(req.params.id)
    if (!Number.isSafeInteger(paintingId) || paintingId < 1) {
      return sendError(res, 400, 'Painting not found.')
    }

    try {
      const painting = db.prepare(`
        SELECT image_data, image_mime_type FROM paintings WHERE id = ?
      `).get(paintingId)
      if (!painting) return sendError(res, 404, 'Painting not found.')
      return res
        .set('Content-Type', painting.image_mime_type)
        .set('Cache-Control', 'public, max-age=3600')
        .send(painting.image_data)
    } catch (error) {
      return next(error)
    }
  })

  app.delete('/api/paintings/:id', requireSession, (req, res, next) => {
    const paintingId = Number(req.params.id)
    if (!Number.isSafeInteger(paintingId) || paintingId < 1) {
      return sendError(res, 400, 'Choose a valid painting to remove.')
    }

    try {
      const painting = db.prepare('SELECT user_id FROM paintings WHERE id = ?').get(paintingId)
      if (!painting) return sendError(res, 404, 'Painting not found.')
      if (painting.user_id !== req.user.id) {
        return sendError(res, 403, 'You can only remove paintings you uploaded.')
      }

      const result = db.prepare('DELETE FROM paintings WHERE id = ? AND user_id = ?')
        .run(paintingId, req.user.id)
      if (result.changes === 0) return sendError(res, 404, 'Painting not found.')

      return res.json({ message: 'Your painting has been removed from the gallery.' })
    } catch (error) {
      return next(error)
    }
  })

  app.post('/api/paintings', requireSession, (req, res, next) => {
    const title = typeof req.body.title === 'string' ? req.body.title.trim() : ''
    if (!title || title.length > 120) {
      return sendError(res, 400, 'Painting titles must be between 1 and 120 characters.')
    }

    const parsedImage = parsePaintingImage(req.body.imageData)
    if (parsedImage.error) return sendError(res, 400, parsedImage.error)

    try {
      const result = db.transaction(() => {
        const paintingCount = db.prepare('SELECT COUNT(*) AS count FROM paintings WHERE user_id = ?')
          .get(req.user.id).count
        if (paintingCount >= MAX_PAINTINGS_PER_USER) return null

        return db.prepare(`
          INSERT INTO paintings (user_id, title, image_data, image_mime_type)
          VALUES (?, ?, ?, ?)
        `).run(req.user.id, title, parsedImage.imageData, parsedImage.imageMimeType)
      }).immediate()

      if (!result) {
        return sendError(res, 409, `You can upload up to ${MAX_PAINTINGS_PER_USER} paintings.`)
      }

      return res.status(201).json({
        painting: {
          id: Number(result.lastInsertRowid),
          title,
          artistName: req.user.name || 'Nanhi Udaan artist',
          imageUrl: `/api/paintings/${result.lastInsertRowid}/image`,
          voteCount: 0,
          hasVoted: false,
        },
      })
    } catch (error) {
      return next(error)
    }
  })

  app.post('/api/paintings/:id/votes', requireSession, (req, res, next) => {
    const paintingId = Number(req.params.id)
    if (!Number.isSafeInteger(paintingId) || paintingId < 1) {
      return sendError(res, 400, 'Choose a valid painting to vote for.')
    }

    try {
      const paintingExists = db.prepare('SELECT id FROM paintings WHERE id = ?').get(paintingId)
      if (!paintingExists) return sendError(res, 404, 'Painting not found.')

      const result = db.prepare(`
        INSERT INTO painting_votes (user_id, painting_id)
        VALUES (?, ?)
        ON CONFLICT(user_id) DO NOTHING
      `).run(req.user.id, paintingId)

      if (result.changes === 0) {
        const existingVote = db.prepare(`
          SELECT painting_id FROM painting_votes WHERE user_id = ?
        `).get(req.user.id)
        return res.status(409).json({
          error: existingVote.painting_id === paintingId
            ? 'You have already voted for this painting.'
            : 'You have already voted for a painting.',
          votedPaintingId: existingVote.painting_id,
        })
      }

      const voteCount = db.prepare(`
        SELECT COUNT(*) AS count FROM painting_votes WHERE painting_id = ?
      `).get(paintingId).count

      return res.status(201).json({
        message: 'Your vote has been recorded.',
        votedPaintingId: paintingId,
        voteCount,
      })
    } catch (error) {
      return next(error)
    }
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

import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createApp } from './app.js'
import { createDatabase } from './database.js'

const currentDirectory = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(currentDirectory, '..', '..')
dotenv.config({ path: path.join(projectRoot, '.env') })

if (!process.env.AUTH_JWT_SECRET || process.env.AUTH_JWT_SECRET.length < 32) {
  throw new Error('AUTH_JWT_SECRET must be set to a secret of at least 32 characters.')
}

const databasePath = path.resolve(
  projectRoot,
  process.env.AUTH_DATABASE_PATH || path.join('server', 'data', 'auth.sqlite'),
)
const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

const db = createDatabase(databasePath)
const app = createApp({
  db,
  jwtSecret: process.env.AUTH_JWT_SECRET,
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  allowedOrigins,
  production: process.env.NODE_ENV === 'production',
})

const port = Number(process.env.PORT || 3000)
app.listen(port, () => {
  console.log(`Nanhi Udaan API listening on http://localhost:${port}`)
})

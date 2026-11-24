import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import bcrypt from 'bcryptjs'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { createDatabase } from '../src/database.js'

const databases = []

function createTestApp({ production = false, googleClientId = '', googleAuthClient } = {}) {
  const db = createDatabase(':memory:')
  databases.push(db)
  const app = createApp({
    db,
    jwtSecret: 'test-jwt-secret-that-is-long-enough-123456',
    googleClientId,
    googleAuthClient,
    production,
  })
  return { app, db }
}

afterEach(() => {
  for (const db of databases.splice(0)) db.close()
})

test('email registration creates a bcrypt account and revocable cookie session', async () => {
  const { app, db } = createTestApp()
  const agent = request.agent(app)

  const registration = await agent.post('/api/auth/register').send({
    name: 'Asha Artist',
    email: 'asha@example.com',
    password: 'a-secure-password',
  })
  assert.equal(registration.status, 201)
  assert.equal(registration.body.user.name, 'Asha Artist')
  assert.match(registration.headers['set-cookie'][0], /HttpOnly/i)
  assert.match(registration.headers['set-cookie'][0], /SameSite=Lax/i)

  const storedUser = db.prepare('SELECT password_hash FROM users WHERE email = ?')
    .get('asha@example.com')
  assert.notEqual(storedUser.password_hash, 'a-secure-password')
  assert.equal(await bcrypt.compare('a-secure-password', storedUser.password_hash), true)
  assert.equal((await agent.get('/api/auth/me')).status, 200)
  assert.equal((await agent.post('/api/auth/register').send({
    name: 'Another Artist',
    email: 'asha@example.com',
    password: 'another-secure-password',
  })).status, 409)

  assert.equal((await agent.post('/api/auth/logout')).status, 200)
  assert.equal((await agent.get('/api/auth/me')).status, 401)
  assert.equal((await agent.post('/api/auth/login').send({
    email: 'asha@example.com',
    password: 'wrong-password',
  })).status, 401)
  assert.equal((await agent.post('/api/auth/login').send({
    email: 'asha@example.com',
    password: 'a-secure-password',
  })).status, 200)
  assert.equal((await agent.get('/api/auth/me')).status, 200)
})

test('Google ID tokens create verified accounts and secure cookie sessions', async () => {
  const googleAuthClient = {
    async verifyIdToken({ idToken, audience }) {
      assert.equal(audience, 'test-google-client-id')
      if (idToken !== 'valid-id-token') throw new Error('Invalid token')
      return {
        getPayload: () => ({
          email: 'google@example.com',
          email_verified: true,
          name: 'Google Artist',
        }),
      }
    },
  }
  const { app, db } = createTestApp({
    production: true,
    googleClientId: 'test-google-client-id',
    googleAuthClient,
  })

  const config = await request(app).get('/api/auth/config')
  assert.equal(config.body.googleClientId, 'test-google-client-id')

  const response = await request(app).post('/api/auth/google').send({ credential: 'valid-id-token' })
  assert.equal(response.status, 200)
  assert.equal(response.body.user.email, 'google@example.com')
  assert.match(response.headers['set-cookie'][0], /Secure/i)
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM sessions').get().count, 1)

  const storedUser = db.prepare('SELECT email_verified_at, password_hash FROM users WHERE email = ?')
    .get('google@example.com')
  assert.ok(storedUser.email_verified_at)
  assert.equal(storedUser.password_hash, null)
})

test('Google sign-in rejects invalid tokens and unverified email addresses', async () => {
  const googleAuthClient = {
    async verifyIdToken({ idToken }) {
      if (idToken === 'invalid') throw new Error('Invalid token')
      return {
        getPayload: () => ({
          email: 'unverified@example.com',
          email_verified: false,
        }),
      }
    },
  }
  const { app } = createTestApp({
    googleClientId: 'test-google-client-id',
    googleAuthClient,
  })

  assert.equal((await request(app).post('/api/auth/google')
    .send({ credential: 'invalid' })).status, 401)
  assert.equal((await request(app).post('/api/auth/google')
    .send({ credential: 'unverified' })).status, 401)
})

test('Google sign-in fails clearly until a client ID is configured', async () => {
  const { app } = createTestApp()

  assert.equal((await request(app).get('/api/auth/config')).body.googleClientId, null)
  const response = await request(app).post('/api/auth/google').send({ credential: 'some-token' })
  assert.equal(response.status, 503)
  assert.equal(response.body.error, 'Google sign-in is not configured.')
  assert.equal((await request(app).post('/api/auth/otp/request').send({})).status, 404)
})

test('state-changing requests reject foreign browser origins', async () => {
  const { app } = createTestApp()
  const response = await request(app)
    .post('/api/auth/logout')
    .set('Origin', 'https://other.example')
  assert.equal(response.status, 403)
})

test('invalid JSON is reported as a client error', async () => {
  const { app } = createTestApp()
  const response = await request(app)
    .post('/api/auth/logout')
    .set('Content-Type', 'application/json')
    .send('{invalid')
  assert.equal(response.status, 400)
  assert.equal(response.body.error, 'Request body must be valid JSON.')
})

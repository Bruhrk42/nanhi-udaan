import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { createDatabase } from '../src/database.js'

const databases = []
const pngData = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lS8AAAAASUVORK5CYII='

function createTestApp() {
  const db = createDatabase(':memory:')
  databases.push(db)
  return {
    app: createApp({
      db,
      jwtSecret: 'test-jwt-secret-that-is-long-enough-123456',
    }),
    db,
  }
}

async function register(agent, name, email) {
  const response = await agent.post('/api/auth/register').send({
    name,
    email,
    password: 'a-secure-password',
  })
  assert.equal(response.status, 201)
  return response.body.user
}

async function uploadPainting(agent, title) {
  return agent.post('/api/paintings').send({
    title,
    imageData: `data:image/png;base64,${pngData}`,
  })
}

afterEach(() => {
  for (const db of databases.splice(0)) db.close()
})

test('authenticated users can upload paintings and gallery refresh retains vote status', async () => {
  const { app, db } = createTestApp()
  const artist = request.agent(app)
  await register(artist, 'Asha Artist', 'asha@example.com')

  const firstUpload = await uploadPainting(artist, 'Sunrise Garden')
  assert.equal(firstUpload.status, 201)
  const secondUpload = await uploadPainting(artist, 'Paper Boats')
  assert.equal(secondUpload.status, 201)

  const gallery = await artist.get('/api/paintings')
  assert.equal(gallery.status, 200)
  assert.equal(gallery.body.authenticated, true)
  assert.equal(gallery.body.votedPaintingId, null)
  assert.equal(gallery.body.paintings.length, 2)

  const painting = gallery.body.paintings.find((item) => item.title === 'Sunrise Garden')
  assert.equal(painting.artistName, 'Asha Artist')
  assert.equal(painting.voteCount, 0)
  assert.equal(painting.hasVoted, false)

  const image = await request(app)
    .get(painting.imageUrl)
    .buffer(true)
    .parse((response, callback) => {
      const chunks = []
      response.on('data', (chunk) => chunks.push(chunk))
      response.on('end', () => callback(null, Buffer.concat(chunks)))
    })
  assert.equal(image.status, 200)
  assert.equal(image.headers['content-type'], 'image/png')
  assert.deepEqual(image.body, Buffer.from(pngData, 'base64'))

  const vote = await artist.post(`/api/paintings/${painting.id}/votes`).send({})
  assert.equal(vote.status, 201)
  assert.equal(vote.body.message, 'Your vote has been recorded.')
  assert.equal(vote.body.voteCount, 1)

  const refreshedGallery = await artist.get('/api/paintings')
  assert.equal(refreshedGallery.body.votedPaintingId, painting.id)
  assert.equal(refreshedGallery.body.paintings.find((item) => item.id === painting.id).hasVoted, true)
  assert.equal(refreshedGallery.body.paintings.find((item) => item.title === 'Paper Boats').hasVoted, false)

  const secondVoter = request.agent(app)
  await register(secondVoter, 'Mira Maker', 'mira@example.com')
  const independentVote = await secondVoter.post(`/api/paintings/${painting.id}/votes`).send({})
  assert.equal(independentVote.status, 201)
  assert.equal(independentVote.body.voteCount, 2)

  const duplicateVote = await artist.post(`/api/paintings/${painting.id}/votes`).send({})
  assert.equal(duplicateVote.status, 409)
  assert.equal(duplicateVote.body.votedPaintingId, painting.id)
  const differentVote = await artist.post(`/api/paintings/${secondUpload.body.painting.id}/votes`).send({})
  assert.equal(differentVote.status, 409)
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM painting_votes').get().count, 2)
})

test('painting writes and votes require an authenticated account', async () => {
  const { app } = createTestApp()
  const painting = await request(app).get('/api/paintings')
  assert.equal(painting.status, 200)
  assert.equal(painting.body.authenticated, false)
  assert.deepEqual(painting.body.paintings, [])

  const upload = await request(app).post('/api/paintings').send({
    title: 'Sunrise Garden',
    imageData: `data:image/png;base64,${pngData}`,
  })
  assert.equal(upload.status, 401)
  assert.equal((await request(app).post('/api/paintings/1/votes').send({})).status, 401)
  assert.equal((await request(app).get('/api/paintings/mine')).status, 401)
  assert.equal((await request(app).delete('/api/paintings/1')).status, 401)
})

test('painting uploads validate title, image type, and image contents', async () => {
  const { app } = createTestApp()
  const artist = request.agent(app)
  await register(artist, 'Asha Artist', 'asha@example.com')

  const missingTitle = await uploadPainting(artist, ' ')
  assert.equal(missingTitle.status, 400)
  const wrongType = await artist.post('/api/paintings').send({
    title: 'Sunrise Garden',
    imageData: `data:image/gif;base64,${pngData}`,
  })
  assert.equal(wrongType.status, 400)
  const invalidImage = await artist.post('/api/paintings').send({
    title: 'Sunrise Garden',
    imageData: 'data:image/png;base64,YWJj',
  })
  assert.equal(invalidImage.status, 400)
})

test('painting dashboard returns only the signed-in user paintings and only owners may remove them', async () => {
  const { app, db } = createTestApp()
  const artist = request.agent(app)
  const otherArtist = request.agent(app)
  await register(artist, 'Asha Artist', 'asha@example.com')
  await register(otherArtist, 'Mira Maker', 'mira@example.com')

  const ownedPainting = await uploadPainting(artist, 'Sunrise Garden')
  const secondOwnedPainting = await uploadPainting(artist, 'Paper Boats')
  const otherPainting = await uploadPainting(otherArtist, 'Blue Birds')
  assert.equal(ownedPainting.status, 201)
  assert.equal(secondOwnedPainting.status, 201)
  assert.equal(otherPainting.status, 201)

  const artistDashboard = await artist.get('/api/paintings/mine')
  assert.equal(artistDashboard.status, 200)
  assert.equal(artistDashboard.body.maxPaintings, 4)
  assert.deepEqual(
    artistDashboard.body.paintings.map((painting) => painting.id).sort(),
    [ownedPainting.body.painting.id, secondOwnedPainting.body.painting.id].sort(),
  )

  const otherDashboard = await otherArtist.get('/api/paintings/mine')
  assert.deepEqual(otherDashboard.body.paintings.map((painting) => painting.id), [
    otherPainting.body.painting.id,
  ])
  assert.equal((await otherArtist.delete(`/api/paintings/${ownedPainting.body.painting.id}`)).status, 403)

  const vote = await artist.post(`/api/paintings/${ownedPainting.body.painting.id}/votes`).send({})
  assert.equal(vote.status, 201)
  const removal = await artist.delete(`/api/paintings/${ownedPainting.body.painting.id}`)
  assert.equal(removal.status, 200)
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM painting_votes WHERE painting_id = ?')
    .get(ownedPainting.body.painting.id).count, 0)

  const refreshedDashboard = await artist.get('/api/paintings/mine')
  assert.equal(refreshedDashboard.body.paintings.length, 1)
  assert.equal(refreshedDashboard.body.paintings[0].id, secondOwnedPainting.body.painting.id)
})

test('painting uploads enforce the four-painting limit and removal frees a slot', async () => {
  const { app } = createTestApp()
  const artist = request.agent(app)
  await register(artist, 'Asha Artist', 'asha@example.com')

  const uploads = []
  for (let index = 1; index <= 4; index += 1) {
    const upload = await uploadPainting(artist, `Painting ${index}`)
    assert.equal(upload.status, 201)
    uploads.push(upload.body.painting)
  }

  const rejectedUpload = await uploadPainting(artist, 'Painting 5')
  assert.equal(rejectedUpload.status, 409)
  assert.match(rejectedUpload.body.error, /up to 4 paintings/)
  assert.equal((await artist.get('/api/paintings/mine')).body.paintings.length, 4)

  const removal = await artist.delete(`/api/paintings/${uploads[0].id}`)
  assert.equal(removal.status, 200)
  assert.equal((await uploadPainting(artist, 'Replacement painting')).status, 201)
  assert.equal((await artist.get('/api/paintings/mine')).body.paintings.length, 4)
})

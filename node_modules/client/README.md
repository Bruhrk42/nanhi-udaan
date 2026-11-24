# Nanhi Udaan

A responsive React landing page for the Nanhi Udaan young artists' painting exhibition in Bhopal. Event copy and category details live in the exhibition feature; the supplied poster is served from `public/images`.

## Run locally

```sh
npm install
```

Create a root `.env` using `.env.example` as a template. Set `AUTH_JWT_SECRET` to a random value of at least 32 characters. For example:

```sh
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

For Google sign-in, create an OAuth 2.0 **Web application** client ID in Google Cloud Console and add `http://localhost:5173` as an authorized JavaScript origin. Put the client ID in `GOOGLE_CLIENT_ID`. No Google client secret is needed for this ID-token flow. Add your production site's origin in Google Cloud Console before deployment.

Start the API and client in separate terminals:

```sh
npm run dev:server
npm run dev
```

## Validate

```sh
npm run lint
npm run build
npm test
```

## Structure

- `server/src/` — Express API, SQLite persistence, password hashing, Google token verification, and JWT cookie sessions
- `src/features/exhibition/` — page sections, navigation, exhibition content, and feature styles
- `src/features/auth/` — Google and email/password sign-in and account creation UI
- `public/images/` — provided exhibition poster and artist icons

The API persists accounts and revocable sessions in SQLite at `server/data/auth.sqlite` by default. Email/password accounts are created directly; passwords are bcrypt-hashed. Google ID tokens are verified by the API and require a Google-verified email. Authentication uses HttpOnly, SameSite=Lax JWT cookies; set `NODE_ENV=production` to enable Secure cookies and set `CLIENT_ORIGIN` to your deployed frontend origin.

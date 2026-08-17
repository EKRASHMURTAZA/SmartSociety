# SmartSociety Full-Stack Setup

## Stack

- Frontend: React + TypeScript + Vite
- Backend: NestJS + TypeScript
- ORM: Prisma
- Database: PostgreSQL
- Auth: Argon2id + HttpOnly session cookie
- QR: qrcode.react + html5-qrcode
- Realtime-ready: SSE notification endpoint
- PWA: manifest + service worker

## 1. Prerequisites

Install:

- Node.js LTS
- PostgreSQL 16+
- Git

Docker is optional. A `docker-compose.yml` is included for PostgreSQL.

## 2. Install dependencies

From the project root:

```bash
npm install
npm run api:install
```

## 3. Database

Start PostgreSQL.

Or:

```bash
docker compose up -d postgres
```

Create `apps/api/.env` from `.env.example`:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/smartsociety?schema=public"
JWT_SECRET="replace-with-a-long-random-secret"
FRONTEND_ORIGIN="http://localhost:5173"
API_PORT="4000"
NODE_ENV="development"
COOKIE_SECURE="false"
UPLOAD_DIR="./uploads"
```

Then:

```bash
npm run db:push
npm run db:seed
```

## 4. Start the application

Terminal 1:

```bash
npm run dev:api
```

Terminal 2:

```bash
npm run dev
```

Or, after installing `concurrently`:

```bash
npm run dev:fullstack
```

## 5. Demo accounts

All seeded accounts use:

```text
Password: SmartSociety@2026
```

Resident:

```text
+91 98765 43210
```

Guard:

```text
+91 98765 43211
```

Admin:

```text
+91 98765 43212
```

Maintenance:

```text
+91 98765 43213
```

Change these credentials before any real deployment.

## 6. QR scanning

Use the Guard → Gate screen.

The browser must allow camera access.

Camera access requires a secure context:

- `http://localhost`
- or HTTPS in deployed environments

The QR contains a server-issued visitor pass code. The guard verifies that code against the backend.

## 7. File uploads

The development implementation stores uploaded images locally under `apps/api/uploads`.

For production, replace the file service with object storage such as S3-compatible storage and private/signed access URLs.

## 8. Production migration

Use Prisma migrations instead of `db push` for production:

```bash
cd apps/api
npx prisma migrate dev --name init
npx prisma migrate deploy
```

Do not commit `.env` or real secrets.

## 9. Verification

Frontend:

```bash
npm run typecheck
npm run build
```

Backend:

```bash
npm run check:api
```

Run both before release.

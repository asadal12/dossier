# Developing Dossier

Vite + React 19 + TypeScript single-page application with an Express API backend, Prisma 7, and native PostgreSQL. No Docker required: all tools and services run directly in Node.js and your native PostgreSQL instance.

For installing and running Dossier, see the [README](README.md); for how it's secured, [SECURITY.md](SECURITY.md).

## Architecture

- **Frontend:** React 19 single-page app bundled with Vite. Client-side routing with React Router.
- **Backend API:** Express server providing REST endpoints, Server Action RPC dispatching, PDF generation, Google OAuth/sync, and background job queues with Server-Sent Events (SSE).
- **Database:** Prisma ORM connecting to a native PostgreSQL 16+ instance.
- **Background Tasks:** Nightly backups, job sweeps, agent scheduler, and inbox synchronizers run within the Express process.

## Getting started

### 1. PostgreSQL Setup

Ensure PostgreSQL is running natively (default `localhost:5432`). Create the primary database and test databases with the `citext` extension:

```sql
CREATE DATABASE dossier;
\c dossier
CREATE EXTENSION IF NOT EXISTS citext;

CREATE DATABASE dossier_test;
\c dossier_test
CREATE EXTENSION IF NOT EXISTS citext;

CREATE DATABASE dossier_e2e;
\c dossier_e2e
CREATE EXTENSION IF NOT EXISTS citext;
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Generate a random secret (at least 32 characters) for `DOSSIER_SECRET`, and hash your password:

```bash
corepack yarn hash-password
```

Set `DOSSIER_PASSWORD` in `.env` to the printed `argon2id:...` hash, and verify `DATABASE_URL` matches your local PostgreSQL credentials:

```bash
DATABASE_URL="postgresql://postgres:your_password@localhost:5432/dossier"
```

### 3. Install & Migrate

```bash
corepack yarn install
corepack yarn prisma migrate deploy
corepack yarn prisma db seed
```

To load sample data for development:
```bash
corepack yarn prisma db seed -- --demo
```

### 4. Run Development Server

```bash
corepack yarn dev
```

Open [http://localhost:3000](http://localhost:3000). The development server runs Express with Vite in middleware mode for instant Hot Module Replacement (HMR).

## Package Scripts

```bash
corepack yarn dev           # starts local dev server with HMR on http://localhost:3000
corepack yarn build         # builds the Vite SPA into dist/
corepack yarn start         # runs the production Express server serving dist/
corepack yarn lint          # runs ESLint checks
corepack yarn typecheck     # runs TypeScript tsc --noEmit
corepack yarn test          # runs Vitest unit, component, and database tests
corepack yarn test:watch    # runs Vitest in watch mode
corepack yarn test:coverage # runs Vitest with coverage report
corepack yarn test:e2e      # runs Playwright end-to-end tests
corepack yarn hash-password # hashes a password for DOSSIER_PASSWORD
```

## Database

Define models in `prisma/schema.prisma`, then create and apply a migration:

```bash
corepack yarn prisma migrate dev --name <migration-name>
```

To browse rows in Prisma Studio:
```bash
corepack yarn prisma studio
```

Query the database from server code with the shared client:

```ts
import { prisma } from "@/lib/prisma";
```

JSON columns (document units, posting extraction, matches, chat edits) are validated with Zod schemas in `src/lib/application-data.ts`. Change an application's status only through `setStatus` in `src/lib/status-actions.ts` (or `changeStatus()` on the client) so funnel statistics stay consistent.

## Server Actions & API Routing

Mutations use `action(schema, handler)` in server action files. The inputs are validated with Zod, and return `{ ok: true, data, toast? } | { ok: false, error, fieldErrors? }`.

The Vite build plugin automatically transforms imports of `"use server"` actions in client code into HTTP calls to `/api/actions/:actionKey`.

For binary responses, streaming, or custom HTTP flows, Express routes in `src/server/routes/` handle:
- `/api/auth/*`: login, logout, and session state
- `/api/loaders/*`: client-side data loaders for each screen
- `/api/jobs/*`: job status and SSE event streams
- `/api/pdf/*`: PDF rendering via Playwright headless Chromium
- `/api/export` & `/api/import`: full data backup and restore

All endpoints enforce strict Same-Origin / CSRF checks and session validation through `requireAuth` middleware and `requestContext`.

## Tests

- `*.test.ts`: pure logic and server code tested in Node.
- `*.test.tsx`: UI components tested in jsdom with React Testing Library.
- `*.db.test.ts`: database tests executing against `dossier_test`. Each test runs in an isolated transaction or resets state via `resetDatabase()`.
- `e2e/*.spec.ts`: full end-to-end workflow tests executed in Chromium against a dedicated test instance with `dossier_e2e`.

# DateSphere

> **Intentional Connections. One New Start. The DateSphere.**

DateSphere is a full-stack, privacy-first dating platform built around a single thesis: **intentionality scales better than volume**. By enforcing scarcity, mutual consent, and real-time commitment locks, DateSphere replaces the swiping treadmill with a deliberate, high-signal matching experience.

This repository is a **proof-of-concept** — a monorepo containing a React/Vite client, a Node.js/Express + Socket.IO server, an SQLite database, and Docker orchestration for reproducible local and cloud deployments.

---

## Table of Contents

- [Problem Statement](#problem-statement)
- [Core Design Principles](#core-design-principles)
- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Setup & Installation](#setup--installation)
- [Environment Variables](#environment-variables)
- [Development Workflow](#development-workflow)
- [Database](#database)
- [Testing](#testing)
- [Security](#security)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

---

## Problem Statement

Modern dating platforms suffer from three systemic failures:

| Issue | Root Cause | Impact |
|---|---|---|
| **Choice Overload** | Infinite match catalogs | Engagement fatigue, decision paralysis |
| **Serial Ghosting** | Zero-accountability swiping | ~75% ghost rate, low-intent interactions |
| **Privacy Erosion** | Unguarded PII in profiles and chats | Safety risks, trust breakdown |

DateSphere addresses each directly through product-level constraints, not social pressure.

---

## Core Design Principles

### 1. Focus Lock (FR1)
When a user accepts a connection request, their discovery feed is locked. Both parties are committed to the active conversation until an explicit disconnect occurs. The API enforces this at the route level — browsing endpoints return `403` if `is_locked = TRUE`.

### 2. Intentionality Cap (FR2)
Users receive a finite monthly slot budget (3–5 new connections). Disconnecting costs a slot. This transforms every connection into a considered investment rather than a reflexive swipe.

### 3. Connection Badge (FR3)
Each profile surfaces a **Lifetime Connection History** count visible to matched partners. This creates a soft accountability signal, discouraging chronic serial-browsing behavior.

### 4. PII Masking (FR4)
Regex-based filters run at both the API middleware layer and the database layer, auto-detecting and blocking phone numbers and email addresses shared in bios or chat messages before they are persisted or transmitted.

---

## Features

- **Real-time chat** via Socket.IO with room-scoped event isolation
- **Vibe-matching engine** using cosine similarity on sentence embeddings (`@xenova/transformers`)
- **JWT authentication** with `bcryptjs` password hashing
- **Focus Lock** — browsing disabled at the API level while a connection is active
- **Slot economy** — monthly connection quota enforced server-side
- **PII filtering** — regex guards on message persistence and profile updates
- **Connection Badge** — lifetime match history surfaced per profile
- **Admin dashboard** for platform moderation
- **Rate limiting** via `express-rate-limit` on all public endpoints
- **Security headers** via `helmet`
- **Dockerized** — single `docker-compose up --build` brings the full stack online
- **Type-safe** throughout — TypeScript on both client and server

---

## Architecture

```
┌──────────────────────────────────┐
│   Client (React 19 + Vite 7)     │  :5173 (dev)  /  :80 (Docker/Nginx)
│   TypeScript · React Router v7   │
│   Socket.IO Client · Framer Motion│
└─────────────────┬────────────────┘
                  │ HTTP/REST + WebSocket (Socket.IO)
┌─────────────────▼────────────────┐
│   Server (Node.js · Express 5)   │  :3000
│   Socket.IO · JWT · Helmet       │
│   express-rate-limit · Validator │
│   @xenova/transformers (vibe AI) │
└─────────────────┬────────────────┘
                  │ SQLite via `sqlite` + `sqlite3`
┌─────────────────▼────────────────┐
│   Database (SQLite)              │
│   Schema managed via migrate.ts  │
│   Seeded via seed.ts             │
└──────────────────────────────────┘
```

**Docker topology (production):**
```
Nginx (:80) → Client static build → proxies /api/* to Server (:3000)
```

---

## Tech Stack

### Frontend
| Technology | Version | Role |
|---|---|---|
| React | 19.x | UI framework |
| TypeScript | ~5.9 | Static typing |
| Vite | 7.x | Dev server & bundler |
| React Router | v7 | Client-side routing |
| Socket.IO Client | 4.x | Real-time communication |
| Framer Motion | 12.x | Animations & transitions |
| Lucide React | 0.56x | Icon system |

### Backend
| Technology | Version | Role |
|---|---|---|
| Node.js | ≥ 18 | Runtime |
| Express | 5.x | HTTP framework |
| TypeScript | ~5.9 | Static typing |
| Socket.IO | 4.x | WebSocket layer |
| SQLite (`sqlite3`) | 6.x | Embedded database |
| `jsonwebtoken` | 9.x | JWT auth |
| `bcryptjs` | 3.x | Password hashing |
| `helmet` | 8.x | HTTP security headers |
| `express-rate-limit` | 7.x | Rate limiting |
| `express-validator` | 7.x | Input validation |
| `@xenova/transformers` | 2.x | On-device AI embeddings |

### Infrastructure
| Technology | Role |
|---|---|
| Docker + docker-compose | Container orchestration |
| Nginx | Reverse proxy, static serving, SSL termination |
| Vitest + Supertest | Server-side unit & integration testing |
| ESLint + Prettier | Code quality & formatting |

---

## Project Structure

```
DateSphere/
├── client/                     # React + Vite frontend
│   ├── src/
│   ├── public/
│   ├── nginx.conf              # Nginx config for production Docker image
│   ├── Dockerfile
│   ├── vite.config.ts
│   └── tsconfig.*.json
├── server/                     # Node.js + Express backend
│   ├── src/
│   │   ├── __tests__/          # Vitest + Supertest test suites
│   │   ├── middleware/         # Auth, rate-limit, PII filter middleware
│   │   ├── routes/             # Express route handlers
│   │   ├── types/              # Shared TypeScript types
│   │   ├── db.ts               # SQLite connection singleton
│   │   ├── index.ts            # Server entry point
│   │   ├── migrate.ts          # Schema migration runner
│   │   ├── schema.sql          # DDL definitions
│   │   ├── socket.ts           # Socket.IO event handlers
│   │   └── vibeEngine.ts       # Cosine-similarity matching engine
│   ├── seed.ts                 # Database seeder
│   ├── Dockerfile
│   └── vitest.config.ts
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## Setup & Installation

### Prerequisites

- **Node.js** `>= 18.x`
- **Docker** `>= 24.x` with **docker-compose** `>= 2.x` *(for containerized setup)*
- **npm** `>= 9.x`

---

### Option A — Docker (Recommended)

The fastest way to get the full stack running locally.

```sh
git clone https://github.com/your-org/DateSphere.git
cd DateSphere

# Copy and configure environment variables
cp .env.example server/.env

docker-compose up --build
```

| Service | URL |
|---|---|
| Client (via Nginx) | http://localhost |
| Server API | http://localhost:3000 |

---

### Option B — Manual (Local Development)

**1. Server**

```sh
cd server
npm install

# Copy environment config
cp ../.env.example .env
# Edit .env — set JWT_SECRET and other values

# Run schema migrations
npm run migrate

# (Optional) Seed with test data
npm run seed

# Start dev server with ts-node
npm run dev
```

Server runs at `http://localhost:3000`.

**2. Client** *(in a separate terminal)*

```sh
cd client
npm install
npm run dev
```

Client runs at `http://localhost:5173`.

---

## Environment Variables

Create `server/.env` based on `.env.example`:

```env
PORT=3000
JWT_SECRET=CHANGE-THIS-TO-A-SECURE-RANDOM-STRING-IN-PRODUCTION
CORS_ORIGIN=http://localhost:5173
NODE_ENV=development
```

> **Never commit `.env` files.** They are listed in `.gitignore`. Rotate `JWT_SECRET` before any production deployment.

---

## Development Workflow

All commands are run from the respective `client/` or `server/` directories unless otherwise noted.

| Task | Directory | Command |
|---|---|---|
| Start client dev server | `client/` | `npm run dev` |
| Start server dev server | `server/` | `npm run dev` |
| Lint (client) | `client/` | `npm run lint` |
| Lint (server) | `server/` | `npm run lint` |
| Type-check (client) | `client/` | `npx tsc --noEmit` |
| Type-check (server) | `server/` | `npx tsc --noEmit` |
| Run DB migrations | `server/` | `npm run migrate` |
| Seed database | `server/` | `npm run seed` |
| Run tests | `server/` | `npm run test` |
| Watch tests | `server/` | `npm run test:watch` |
| Production build | `client/` | `npm run build` |

---

## Database

DateSphere uses **SQLite** (`sqlite` + `sqlite3`) as an embedded database for development and containerized deployments. The schema is managed through `server/src/migrate.ts`, which reads and executes `server/src/schema.sql`.

### Key Entities

```
USER        UserID (PK), Name, SlotsLeft, IsLocked, CulturalTag, VibeVector
MATCH       MatchID (PK), UserA_ID (FK), UserB_ID (FK), Status
CHAT_LOG    LogID (PK), MatchID (FK), MessageBody, Masked_Flag, Timestamp
```

### Business Logic Enforced at the DB/API Layer

- `IS_LOCKED = TRUE` → browsing endpoints return `403 Forbidden`
- `SLOTS_LEFT = 0` → new connection requests are blocked
- Regex filter on `MessageBody` sets `MASKED_FLAG = TRUE` and strips PII before persistence

### Migrations & Seeding

```sh
# Apply schema
npm run migrate --prefix server

# Load seed data
npm run seed --prefix server
```

---

## Testing

Tests live in `server/src/__tests__/` and are run with **Vitest** + **Supertest**.

```sh
# Run all tests once
cd server && npm run test

# Watch mode
cd server && npm run test:watch
```

Coverage reports are output to `server/coverage/`.

---

## Security

| Control | Implementation |
|---|---|
| Authentication | JWT (`jsonwebtoken`), tokens validated on every protected route |
| Password storage | `bcryptjs` with cost factor ≥ 10 |
| HTTP headers | `helmet` — sets `Content-Security-Policy`, `X-Frame-Options`, etc. |
| Rate limiting | `express-rate-limit` on all public endpoints |
| Input validation | `express-validator` on all mutation routes |
| PII filtering | Regex guards in middleware and DB insert paths |
| Secrets management | `.env` files, excluded via `.gitignore`; never hard-coded |
| Dependency hygiene | Run `npm audit` regularly; update dependencies on CVE advisories |

---

## Deployment

### Docker (Production)

```sh
# Build and start in detached mode
docker-compose up --build -d
```

- The `client` Docker image builds the Vite SPA and serves it via **Nginx** on port `80`.
- The `server` Docker image compiles TypeScript and runs `node dist/index.js` on port `3000`.
- A named Docker volume (`db-data`) persists the SQLite database across container restarts.
- Override `JWT_SECRET` and `CORS_ORIGIN` via Docker secrets or your cloud provider's environment variable injection before going live.

### Nginx (Client)

The client Nginx config (`client/nginx.conf`) proxies `/api/*` and `/socket.io/*` requests to the server container, enabling a single-origin setup with no CORS overhead in production.

---

## Contributing

1. **Fork** the repository and create a feature branch from `main`:
   ```sh
   git checkout -b feat/your-feature-name
   ```
2. Follow the existing **TypeScript** style — no `any`, prefer explicit return types.
3. **Write tests** for any new API routes or business logic.
4. Ensure `npm run lint` and `npm run test` pass before opening a PR.
5. Open a **Pull Request** with a clear title, description, and references to any related issues.
6. PRs require at least one approving review before merge.

---

## License

This project is licensed under the [MIT License](LICENSE).

---

*DateSphere — Quality connections over quantity catalogs.*

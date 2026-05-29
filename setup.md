# DateSphere: Intentional Connection Ecosystem

> **No infinite swiping. 5 connection slots per month. Privacy-first AI matching. Focus Lock conversations.**

## 🚀 Quick Start (Development)

### Prerequisites
- Node.js 18+ 
- npm

### 1. Clone & Install
```bash
# Install server
cd server
npm install

# Install client
cd ../client
npm install
```

### 2. Setup Database
```bash
cd server
npm run migrate
npm run seed
```
> Seeds 8 demo profiles. Default password: `password123`

### 3. Launch

**Terminal 1 — Backend:**
```bash
cd server
npm run dev
```
> API: http://localhost:3000 | WebSocket: ws://localhost:3000 | Health: http://localhost:3000/api/health

**Terminal 2 — Frontend:**
```bash
cd client
npm run dev
```
> UI: http://localhost:5173

### 4. Demo Login
Use any of these usernames with password `password123`:
- `aisha_k` — Kashmiri poet & hiker
- `david_m` — American tech builder  
- `priya_s` — Punjabi dancer & coder
- `carlos_r` — Latino photographer
- `yuki_t` — Japanese chef & gamer
- `fatima_a` — Turkish architect
- `liam_w` — Australian marine biologist
- `jin_p` — Korean choreographer

---

## 🧪 Running Tests

```bash
cd server
npm test
```

Tests cover:
- **PII Filter**: phone, email, social handle, URL detection & redaction
- **Auth**: registration, login, JWT tokens, password hashing
- **Connections**: Intentionality Cap, duplicate prevention, mutual auto-accept, Focus Lock
- **Messages**: PII masking, participant-only access, empty message validation
- **Users**: Focus Lock on discovery, profile CRUD, soft delete

---

## 🐳 Docker Deployment

```bash
# Single command deployment
docker-compose up --build

# Access at http://localhost
```

---

## 🏗️ Architecture

```
DateSphere/
├── server/                     # Express + Socket.io + SQLite
│   ├── src/
│   │   ├── middleware/         # Auth, validation, PII filter, error handler
│   │   ├── routes/            # Auth, users, connections, messages, admin
│   │   ├── __tests__/         # Vitest test suite
│   │   ├── socket.ts          # Real-time WebSocket layer
│   │   ├── index.ts           # Server entry (Express + Socket.io)
│   │   ├── db.ts              # SQLite connection
│   │   └── schema.sql         # Database schema
│   └── seed.ts                # Demo data
├── client/                     # React + Vite + TypeScript
│   ├── src/
│   │   ├── components/        # Toast, SkeletonCard, ConnectionBadge, CreditCounter
│   │   ├── pages/             # Login, Dashboard, Chat
│   │   ├── types/             # TypeScript interfaces
│   │   └── utils/             # API client, AI vibe matcher
│   └── index.html
└── docker-compose.yml          # One-command deployment
```

## 🔑 Core Features

| Feature | Description |
|---------|-------------|
| **Intentionality Cap** | 5 connection slots/month. Forces quality over quantity. |
| **Focus Lock** | When connected, both users' discovery is disabled. Full attention. |
| **PII Masking** | Phone numbers, emails, social handles auto-redacted in messages & bios. |
| **Connection Badge** | Lifetime connection counter. Accountability & trust signal. |
| **Privacy-First AI** | Transformers.js runs in-browser. Your data never hits the server. |
| **Real-Time Chat** | Socket.io with typing indicators, online status, instant delivery. |
| **JWT Auth** | Secure token-based authentication with 7-day expiry. |

## 🌍 Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `JWT_SECRET` | `datesphere-dev-secret...` | JWT signing secret (**change in prod!**) |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed frontend origin |
| `NODE_ENV` | `development` | `development` or `production` |

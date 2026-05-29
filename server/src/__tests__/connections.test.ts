import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import { createServer, Server as HttpServer } from 'http';
import request from 'supertest';
import { getDb, resetDb } from '../db';
import bcrypt from 'bcryptjs';
import { signToken } from '../middleware/auth';

import connectionRoutes from '../routes/connections';
import { globalErrorHandler } from '../middleware/errorHandler';

let app: express.Express;
let server: HttpServer;
let tokenA: string;
let tokenB: string;
let userAId: number;
let userBId: number;

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    avatar_url TEXT, bio TEXT NOT NULL,
    cultural_id VARCHAR(255), vibe_vector TEXT, interests TEXT,
    credits INTEGER DEFAULT 5 CHECK(credits >= 0),
    total_connections INTEGER DEFAULT 0,
    is_locked BOOLEAN DEFAULT 0,
    is_deleted BOOLEAN DEFAULT 0,
    credits_reset_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS connections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_a_id INTEGER REFERENCES users(id),
    user_b_id INTEGER REFERENCES users(id),
    status VARCHAR(50) DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_a_id, user_b_id)
  );
`;

async function createTestUser(username: string, credits = 5) {
  const db = await getDb();
  const hash = await bcrypt.hash('pass', 10);
  const result = await db.run(
    `INSERT INTO users (username, password, display_name, bio, credits) VALUES (?, ?, ?, ?, ?)`,
    [username, hash, `Test ${username}`, `Bio for ${username} with enough characters for tests`, credits]
  );
  return result.lastID!;
}

beforeAll(async () => {
  await resetDb();

  app = express();
  app.use(express.json());
  app.use('/api/connections', connectionRoutes);
  app.use(globalErrorHandler as any);
  server = createServer(app);

  const db = await getDb();
  await db.exec(SCHEMA);
});

beforeEach(async () => {
  const db = await getDb();
  await db.run('DELETE FROM connections');
  await db.run('DELETE FROM users');

  userAId = await createTestUser('user_a', 5);
  userBId = await createTestUser('user_b', 5);
  tokenA = signToken({ id: userAId, username: 'user_a' });
  tokenB = signToken({ id: userBId, username: 'user_b' });
});

afterAll(async () => {
  server?.close();
  await resetDb();
});

describe('Connection Routes', () => {
  describe('POST /api/connections/request', () => {
    it('sends a vibe request successfully', async () => {
      const res = await request(app)
        .post('/api/connections/request')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ user_b_id: userBId });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.connection_id).toBeDefined();
    });

    it('rejects self-request', async () => {
      const res = await request(app)
        .post('/api/connections/request')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ user_b_id: userAId });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('SELF_REQUEST');
    });

    it('rejects duplicate request', async () => {
      await request(app)
        .post('/api/connections/request')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ user_b_id: userBId });

      const res = await request(app)
        .post('/api/connections/request')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ user_b_id: userBId });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('DUPLICATE_REQUEST');
    });

    it('rejects when credits exhausted (Intentionality Cap)', async () => {
      const brokeId = await createTestUser('broke_user', 0);
      const brokeToken = signToken({ id: brokeId, username: 'broke_user' });

      const res = await request(app)
        .post('/api/connections/request')
        .set('Authorization', `Bearer ${brokeToken}`)
        .send({ user_b_id: userBId });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('CREDITS_EXHAUSTED');
    });

    it('auto-accepts mutual requests', async () => {
      // A → B
      await request(app)
        .post('/api/connections/request')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ user_b_id: userBId });

      // B → A (should auto-accept)
      const res = await request(app)
        .post('/api/connections/request')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ user_b_id: userAId });

      expect(res.status).toBe(200);
      expect(res.body.data.mutual).toBe(true);

      // Both users should be locked
      const db = await getDb();
      const userA = await db.get('SELECT is_locked FROM users WHERE id = ?', [userAId]);
      const userB = await db.get('SELECT is_locked FROM users WHERE id = ?', [userBId]);
      expect(userA.is_locked).toBe(1);
      expect(userB.is_locked).toBe(1);
    });
  });

  describe('POST /api/connections/accept', () => {
    it('accepts a request and locks both users with badge + credit changes', async () => {
      const reqRes = await request(app)
        .post('/api/connections/request')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ user_b_id: userBId });

      const connectionId = reqRes.body.data.connection_id;

      const res = await request(app)
        .post('/api/connections/accept')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ connection_id: connectionId });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const db = await getDb();
      const userA = await db.get('SELECT is_locked, total_connections, credits FROM users WHERE id = ?', [userAId]);
      const userB = await db.get('SELECT is_locked, total_connections, credits FROM users WHERE id = ?', [userBId]);

      expect(userA.is_locked).toBe(1);
      expect(userB.is_locked).toBe(1);
      expect(userA.total_connections).toBe(1);
      expect(userB.total_connections).toBe(1);
      expect(userA.credits).toBe(4);
      expect(userB.credits).toBe(4);
    });
  });

  describe('POST /api/connections/end', () => {
    it('ends connection and unlocks both users', async () => {
      const reqRes = await request(app)
        .post('/api/connections/request')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ user_b_id: userBId });

      await request(app)
        .post('/api/connections/accept')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ connection_id: reqRes.body.data.connection_id });

      const res = await request(app)
        .post('/api/connections/end')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ connection_id: reqRes.body.data.connection_id });

      expect(res.status).toBe(200);

      const db = await getDb();
      const userA = await db.get('SELECT is_locked FROM users WHERE id = ?', [userAId]);
      const userB = await db.get('SELECT is_locked FROM users WHERE id = ?', [userBId]);
      expect(userA.is_locked).toBe(0);
      expect(userB.is_locked).toBe(0);
    });
  });
});

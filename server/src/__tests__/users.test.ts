import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import { createServer, Server as HttpServer } from 'http';
import request from 'supertest';
import { getDb, resetDb } from '../db';
import bcrypt from 'bcryptjs';
import { signToken } from '../middleware/auth';

import userRoutes from '../routes/users';
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
    is_locked BOOLEAN DEFAULT 0, is_deleted BOOLEAN DEFAULT 0,
    credits_reset_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS connections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_a_id INTEGER, user_b_id INTEGER,
    status VARCHAR(50) DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_a_id, user_b_id)
  );
`;

beforeAll(async () => {
  await resetDb();

  app = express();
  app.use(express.json());
  app.use('/api/users', userRoutes);
  app.use(globalErrorHandler as any);
  server = createServer(app);

  const db = await getDb();
  await db.exec(SCHEMA);
});

beforeEach(async () => {
  const db = await getDb();
  await db.run('DELETE FROM connections');
  await db.run('DELETE FROM users');

  const hash = await bcrypt.hash('pass', 10);
  const rA = await db.run(`INSERT INTO users (username, password, display_name, bio) VALUES (?, ?, ?, ?)`,
    ['usr_a', hash, 'User A', 'An unlocked user for testing']);
  const rB = await db.run(`INSERT INTO users (username, password, display_name, bio) VALUES (?, ?, ?, ?)`,
    ['usr_b', hash, 'User B', 'Another unlocked user for testing']);

  userAId = rA.lastID!;
  userBId = rB.lastID!;
  tokenA = signToken({ id: userAId, username: 'usr_a' });
  tokenB = signToken({ id: userBId, username: 'usr_b' });
});

afterAll(async () => {
  server?.close();
  await resetDb();
});

describe('User Routes', () => {
  describe('GET /api/users', () => {
    it('returns discoverable users (excludes self)', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].username).toBe('usr_b');
    });

    it('returns empty for locked users (Focus Lock)', async () => {
      const db = await getDb();
      await db.run('UPDATE users SET is_locked = 1 WHERE id = ?', [userAId]);

      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });

    it('excludes deleted users from results', async () => {
      const db = await getDb();
      await db.run('UPDATE users SET is_deleted = 1 WHERE id = ?', [userBId]);

      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.body.data).toHaveLength(0);
    });
  });

  describe('PUT /api/users/:id', () => {
    it('updates own profile', async () => {
      const res = await request(app)
        .put(`/api/users/${userAId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ display_name: 'Updated Name', bio: 'Updated bio with enough characters for the minimum validation length' });

      expect(res.status).toBe(200);
      expect(res.body.data.user.display_name).toBe('Updated Name');
    });

    it('rejects updating another user profile', async () => {
      const res = await request(app)
        .put(`/api/users/${userBId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ display_name: 'Hacked' });

      expect(res.status).toBe(403);
    });

    it('filters PII from bio update', async () => {
      const res = await request(app)
        .put(`/api/users/${userAId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ bio: 'Contact me at hacker@evil.com for more info please reach out' });

      expect(res.status).toBe(200);
      expect(res.body.data.user.bio).not.toContain('hacker@evil.com');
      expect(res.body.data.piiWarning).toBeDefined();
    });
  });

  describe('DELETE /api/users/:id', () => {
    it('soft deletes own account', async () => {
      const res = await request(app)
        .delete(`/api/users/${userAId}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);

      const db = await getDb();
      const user = await db.get('SELECT is_deleted FROM users WHERE id = ?', [userAId]);
      expect(user.is_deleted).toBe(1);
    });

    it('rejects deleting another user account', async () => {
      const res = await request(app)
        .delete(`/api/users/${userBId}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(403);
    });
  });
});

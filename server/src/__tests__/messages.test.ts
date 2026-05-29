import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import { createServer, Server as HttpServer } from 'http';
import request from 'supertest';
import { getDb, resetDb } from '../db';
import bcrypt from 'bcryptjs';
import { signToken } from '../middleware/auth';

import messageRoutes from '../routes/messages';
import { globalErrorHandler } from '../middleware/errorHandler';

let app: express.Express;
let server: HttpServer;
let tokenA: string;
let tokenB: string;
let tokenC: string;
let userAId: number;
let userBId: number;
let userCId: number;
let activeConnectionId: number;

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
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    connection_id INTEGER, sender_id INTEGER,
    content TEXT NOT NULL, pii_detected BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`;

beforeAll(async () => {
  await resetDb();

  app = express();
  app.use(express.json());
  app.use('/api/messages', messageRoutes);
  app.use(globalErrorHandler as any);
  server = createServer(app);

  const db = await getDb();
  await db.exec(SCHEMA);
});

beforeEach(async () => {
  const db = await getDb();
  await db.run('DELETE FROM messages');
  await db.run('DELETE FROM connections');
  await db.run('DELETE FROM users');

  const hash = await bcrypt.hash('pass', 10);
  const rA = await db.run(`INSERT INTO users (username, password, display_name, bio) VALUES (?, ?, ?, ?)`,
    ['msg_a', hash, 'User A', 'Bio for user A testing messages']);
  const rB = await db.run(`INSERT INTO users (username, password, display_name, bio) VALUES (?, ?, ?, ?)`,
    ['msg_b', hash, 'User B', 'Bio for user B testing messages']);
  const rC = await db.run(`INSERT INTO users (username, password, display_name, bio) VALUES (?, ?, ?, ?)`,
    ['msg_c', hash, 'User C', 'Bio for user C no connection']);

  userAId = rA.lastID!;
  userBId = rB.lastID!;
  userCId = rC.lastID!;

  tokenA = signToken({ id: userAId, username: 'msg_a' });
  tokenB = signToken({ id: userBId, username: 'msg_b' });
  tokenC = signToken({ id: userCId, username: 'msg_c' });

  // Create active connection between A and B
  const conn = await db.run(
    `INSERT INTO connections (user_a_id, user_b_id, status) VALUES (?, ?, 'active')`,
    [userAId, userBId]
  );
  activeConnectionId = conn.lastID!;
});

afterAll(async () => {
  server?.close();
  await resetDb();
});

describe('Message Routes', () => {
  describe('POST /api/messages', () => {
    it('sends a message successfully', async () => {
      const res = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          connection_id: activeConnectionId,
          content: 'Hello! How are you?',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message.content).toBe('Hello! How are you?');
      expect(res.body.data.message.pii_detected).toBe(0);
    });

    it('redacts phone numbers (PII Masking)', async () => {
      const res = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          connection_id: activeConnectionId,
          content: 'Text me at 555-123-4567',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.message.content).toContain('[REDACTED]');
      expect(res.body.data.message.content).not.toContain('555-123-4567');
      expect(res.body.data.message.pii_detected).toBe(1);
      expect(res.body.data.piiWarning).toBeDefined();
      expect(res.body.data.piiTypes).toContain('phone');
    });

    it('redacts email addresses (PII Masking)', async () => {
      const res = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          connection_id: activeConnectionId,
          content: 'My email is test@gmail.com',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.message.content).not.toContain('test@gmail.com');
      expect(res.body.data.piiTypes).toContain('email');
    });

    it('rejects message from non-participant', async () => {
      const res = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${tokenC}`)
        .send({
          connection_id: activeConnectionId,
          content: 'I should not be able to send this',
        });

      expect(res.status).toBe(403);
    });

    it('rejects empty messages', async () => {
      const res = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          connection_id: activeConnectionId,
          content: '',
        });

      expect(res.status).toBe(422);
    });
  });

  describe('GET /api/messages/:connectionId', () => {
    it('returns messages for participants', async () => {
      await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ connection_id: activeConnectionId, content: 'Message 1' });

      await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ connection_id: activeConnectionId, content: 'Message 2' });

      const res = await request(app)
        .get(`/api/messages/${activeConnectionId}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].content).toBe('Message 1');
      expect(res.body.data[1].content).toBe('Message 2');
    });

    it('rejects non-participant from reading messages', async () => {
      const res = await request(app)
        .get(`/api/messages/${activeConnectionId}`)
        .set('Authorization', `Bearer ${tokenC}`);

      expect(res.status).toBe(403);
    });
  });
});

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import { createServer, Server as HttpServer } from 'http';
import request from 'supertest';
import { getDb, resetDb } from '../db';
import bcrypt from 'bcryptjs';

import authRoutes from '../routes/auth';
import { globalErrorHandler } from '../middleware/errorHandler';

let app: express.Express;
let server: HttpServer;

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
  )
`;

beforeAll(async () => {
  // Reset to get a fresh in-memory DB
  await resetDb();
  
  app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  app.use(globalErrorHandler as any);
  server = createServer(app);
  
  const db = await getDb();
  await db.exec(SCHEMA);
});

beforeEach(async () => {
  const db = await getDb();
  await db.run('DELETE FROM users');
});

afterAll(async () => {
  server?.close();
  await resetDb();
});

describe('Auth Routes', () => {
  describe('POST /api/auth/register', () => {
    it('registers a new user and returns JWT', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          password: 'password123',
          display_name: 'Test User',
          bio: 'A test user for the DateSphere platform with interesting hobbies',
          cultural_id: 'Global',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.username).toBe('testuser');
      expect(res.body.data.user.display_name).toBe('Test User');
      expect(res.body.data.user.password).toBeUndefined();
    });

    it('hashes the password in the database', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          username: 'hashtest',
          password: 'mypassword',
          display_name: 'Hash Test',
          bio: 'Testing password hashing in the database layer',
        });

      const db = await getDb();
      const user = await db.get('SELECT password FROM users WHERE username = ?', ['hashtest']);
      expect(user.password).not.toBe('mypassword');
      const isHashed = await bcrypt.compare('mypassword', user.password);
      expect(isHashed).toBe(true);
    });

    it('rejects duplicate username with 409', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          username: 'duplicate',
          password: 'pass1234',
          display_name: 'First',
          bio: 'First user with this username in the system',
        });

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'duplicate',
          password: 'pass5678',
          display_name: 'Second',
          bio: 'Second attempt with the same username should fail',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('USERNAME_EXISTS');
    });

    it('rejects missing fields with 422', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ username: 'incomplete' });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.fields).toBeDefined();
    });

    it('filters PII from bio on registration', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'piiuser',
          password: 'pass1234',
          display_name: 'PII User',
          bio: 'Contact me at test@email.com or call 555-123-4567 for details',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.piiWarning).toBeDefined();
      expect(res.body.data.user.bio).not.toContain('test@email.com');
      expect(res.body.data.user.bio).toContain('[REDACTED]');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          username: 'logintest',
          password: 'correctpassword',
          display_name: 'Login Test',
          bio: 'This is a test account for login verification testing',
        });
    });

    it('logs in with correct credentials and returns JWT', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'logintest', password: 'correctpassword' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.username).toBe('logintest');
    });

    it('rejects wrong password with 401', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'logintest', password: 'wrongpassword' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects non-existent user with 401', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'nonexistent', password: 'anything' });

      expect(res.status).toBe(401);
    });
  });
});

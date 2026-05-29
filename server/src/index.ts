import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import dotenv from 'dotenv';
import path from 'path';

// Load environment
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { globalErrorHandler } from './middleware/errorHandler';
import { initializeSocket } from './socket';
import { warmUpVibeEngine } from './vibeEngine';

// Route imports
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import connectionRoutes from './routes/connections';
import messageRoutes from './routes/messages';
import adminRoutes from './routes/admin';

const app = express();
const httpServer = createServer(app);
const port = parseInt(process.env.PORT || '3000', 10);

// ─── Security Middleware ──────────────────────────────────────

app.use(helmet({
  contentSecurityPolicy: false, // Disabled for dev — SPA serves its own CSP
}));

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));

// Rate limiting — 100 requests per 15 min per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 200,
  message: {
    success: false,
    error: 'Too many requests. Please try again later.',
    code: 'RATE_LIMITED',
  },
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});
app.use(limiter);

// Stricter rate limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: {
    success: false,
    error: 'Too many authentication attempts. Please wait 15 minutes.',
    code: 'AUTH_RATE_LIMITED',
  },
});

app.use(express.json({ limit: '1mb' }));

// ─── Initialize Socket.io ────────────────────────────────────

const io = initializeSocket(httpServer);

// Make io available to routes for emitting events
app.set('io', io);

// ─── API Routes ───────────────────────────────────────────────

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🌍 DateSphere API Server',
    status: 'running',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      users: '/api/users',
      connections: '/api/connections',
      messages: '/api/messages',
      admin: '/api/admin',
    },
    websocket: 'ws://localhost:3000',
  });
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/connections', connectionRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api', adminRoutes);

// ─── Global Error Handler (must be last) ──────────────────────

app.use(globalErrorHandler as any);

// ─── Start Server ─────────────────────────────────────────────

httpServer.listen(port, () => {
  console.log('');
  console.log('  ╔═══════════════════════════════════════════════╗');
  console.log('  ║                                               ║');
  console.log('  ║   🌐 DateSphere Server                        ║');
  console.log(`  ║   API:       http://localhost:${port}             ║`);
  console.log(`  ║   WebSocket: ws://localhost:${port}              ║`);
  console.log(`  ║   Health:    http://localhost:${port}/api/health  ║`);
  console.log('  ║                                               ║');
  console.log('  ╚═══════════════════════════════════════════════╝');
  console.log('');

  // Warm up the vibe engine in the background — non-blocking
  warmUpVibeEngine().catch(() => {});
});

// ─── Graceful Shutdown ────────────────────────────────────────

const shutdown = () => {
  console.log('\n  Shutting down gracefully...');
  io.close();
  httpServer.close(() => {
    console.log('  Server closed.');
    process.exit(0);
  });
  // Force close after 10s
  setTimeout(() => process.exit(1), 10000);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

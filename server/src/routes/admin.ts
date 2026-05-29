import { Router } from 'express';
import { getDb } from '../db';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

/**
 * GET /api/health
 * Health check endpoint for monitoring / Docker.
 */
router.get(
  '/health',
  asyncHandler(async (_req, res) => {
    const db = await getDb();
    await db.get('SELECT 1'); // Verify DB connection
    res.json({
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      },
    });
  })
);

/**
 * GET /api/admin/db
 * Full database dump for development/demo purposes.
 * In production, this would be behind admin auth.
 */
router.get(
  '/admin/db',
  asyncHandler(async (_req, res) => {
    const db = await getDb();
    const users = await db.all(
      `SELECT id, username, display_name, bio, cultural_id, interests, avatar_url, 
              is_locked, credits, total_connections, created_at 
       FROM users WHERE is_deleted = 0`
    );
    const connections = await db.all('SELECT * FROM connections ORDER BY created_at DESC');
    const messages = await db.all('SELECT * FROM messages ORDER BY created_at DESC LIMIT 100');

    res.json({
      success: true,
      data: { users, connections, messages },
    });
  })
);

export default router;

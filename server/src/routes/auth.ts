import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { getDb } from '../db';
import { signToken } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { validateRegister, validateLogin } from '../middleware/validate';
import { filterPii } from '../middleware/piiFilter';
import { computeEmbedding } from '../vibeEngine';
import { AuthenticatedRequest, SafeUser } from '../types';

const router = Router();

/**
 * POST /api/auth/register
 * Create a new user account and return JWT token.
 */
router.post(
  '/register',
  validateRegister,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { username, password, display_name, bio, cultural_id, interests } = req.body;

    const db = await getDb();

    // Check for existing username
    const existing = await db.get('SELECT id FROM users WHERE username = ?', [username]);
    if (existing) {
      res.status(409).json({
        success: false,
        error: 'Username already taken. Try another one.',
        code: 'USERNAME_EXISTS',
      });
      return;
    }

    // PII filter on bio
    const filteredBio = filterPii(bio);

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Compute semantic embedding for vibe matching
    let vibeVector: string | null = null;
    try {
      const vec = await computeEmbedding(filteredBio.sanitized);
      vibeVector = JSON.stringify(vec);
    } catch (err) {
      // Non-fatal — vibe matching degrades gracefully without a vector
      console.error('Warning: could not compute vibe_vector on register:', err);
    }

    const result = await db.run(
      `INSERT INTO users (username, password, display_name, bio, cultural_id, interests, vibe_vector) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [username, hashedPassword, display_name, filteredBio.sanitized, cultural_id || null, interests || null, vibeVector]
    );

    const user = await db.get(
      `SELECT id, username, display_name, bio, cultural_id, interests, avatar_url, 
              is_locked, credits, total_connections, created_at 
       FROM users WHERE id = ?`,
      [result.lastID]
    );

    // Generate JWT
    const token = signToken({ id: user.id, username: user.username });

    res.status(201).json({
      success: true,
      data: {
        token,
        user: user as SafeUser,
        ...(filteredBio.detected && {
          piiWarning: 'Some personal information was redacted from your bio for privacy.',
        }),
      },
    });
  })
);

/**
 * POST /api/auth/login
 * Authenticate and return JWT token + user data.
 */
router.post(
  '/login',
  validateLogin,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { username, password } = req.body;

    const db = await getDb();
    const user = await db.get('SELECT * FROM users WHERE username = ? AND is_deleted = 0', [username]);

    if (!user) {
      res.status(401).json({
        success: false,
        error: 'Invalid credentials.',
        code: 'INVALID_CREDENTIALS',
      });
      return;
    }

    // Try bcrypt comparison first, then plaintext fallback for legacy seeded users
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch && user.password !== password) {
      res.status(401).json({
        success: false,
        error: 'Invalid credentials.',
        code: 'INVALID_CREDENTIALS',
      });
      return;
    }

    // Check monthly credit reset (30-day cycle)
    const resetAt = new Date(user.credits_reset_at).getTime();
    const now = Date.now();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    
    if (now - resetAt > thirtyDays) {
      await db.run(
        'UPDATE users SET credits = 5, credits_reset_at = CURRENT_TIMESTAMP WHERE id = ?',
        [user.id]
      );
      user.credits = 5;
    }

    // Generate JWT
    const token = signToken({ id: user.id, username: user.username });

    // Remove sensitive data
    const { password: _, is_deleted, ...safeUser } = user;

    res.json({
      success: true,
      data: {
        token,
        user: safeUser,
      },
    });
  })
);

export default router;

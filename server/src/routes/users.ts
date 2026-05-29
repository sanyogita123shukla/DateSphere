import { Router } from 'express';
import { getDb } from '../db';
import { asyncHandler, HttpError } from '../middleware/errorHandler';
import { authMiddleware } from '../middleware/auth';
import { validateUpdateProfile, validateParamId } from '../middleware/validate';
import { filterPii } from '../middleware/piiFilter';
import { computeEmbedding, cosineSimilarity } from '../vibeEngine';
import { AuthenticatedRequest } from '../types';

const router = Router();

// All user routes require authentication
router.use(authMiddleware as any);

/**
 * GET /api/users
 * List discoverable users. Enforces Focus Lock: locked users get empty results.
 */
router.get(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const db = await getDb();
    const userId = req.user!.id;

    // Focus Lock enforcement: if requester is locked, return empty
    const me = await db.get('SELECT is_locked FROM users WHERE id = ?', [userId]);
    if (me?.is_locked) {
      res.json({ success: true, data: [] });
      return;
    }

    const users = await db.all(
      `SELECT id, username, display_name, bio, cultural_id, interests, avatar_url, 
              is_locked, credits, total_connections, created_at 
       FROM users 
       WHERE id != ? AND is_locked = 0 AND is_deleted = 0
       ORDER BY created_at DESC`,
      [userId]
    );

    res.json({ success: true, data: users });
  })
);

/**
 * GET /api/users/vibe-matches
 * Server-computed semantic similarity sorted discovery.
 * Returns all discoverable users with a `vibe_score` field (0-1).
 * Much faster than browser WASM — no model download per user.
 */
router.get(
  '/vibe-matches',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const db = await getDb();
    const userId = req.user!.id;

    // Focus Lock enforcement
    const me = await db.get(
      'SELECT is_locked, vibe_vector FROM users WHERE id = ?',
      [userId]
    );
    if (me?.is_locked) {
      res.json({ success: true, data: [] });
      return;
    }

    // Fetch all discoverable users including their stored vectors
    const users = await db.all(
      `SELECT id, username, display_name, bio, cultural_id, interests,
              avatar_url, is_locked, credits, total_connections, created_at,
              vibe_vector
       FROM users
       WHERE id != ? AND is_locked = 0 AND is_deleted = 0
       ORDER BY created_at DESC`,
      [userId]
    );

    // Parse requester's vector
    let myVec: number[] | null = null;
    if (me?.vibe_vector) {
      try {
        myVec = JSON.parse(me.vibe_vector);
      } catch { /* malformed vector — skip scoring */ }
    }

    // If requester has no stored vector, compute it now and persist it
    if (!myVec) {
      const meRow = await db.get('SELECT bio FROM users WHERE id = ?', [userId]);
      if (meRow?.bio) {
        try {
          myVec = await computeEmbedding(meRow.bio);
          await db.run(
            'UPDATE users SET vibe_vector = ? WHERE id = ?',
            [JSON.stringify(myVec), userId]
          );
        } catch (err) {
          console.error('Could not compute requester vibe_vector:', err);
        }
      }
    }

    // Score each user and strip the raw vector from the response
    const scored = users.map((u: any) => {
      const { vibe_vector, ...safeUser } = u;
      let vibe_score: number | null = null;

      if (myVec && vibe_vector) {
        try {
          const peerVec: number[] = JSON.parse(vibe_vector);
          vibe_score = Math.round(cosineSimilarity(myVec, peerVec) * 1000) / 1000;
        } catch { /* skip */ }
      }

      return { ...safeUser, vibe_score };
    });

    // Sort: scored users first (descending), unscored at end
    scored.sort((a: any, b: any) => {
      if (a.vibe_score === null && b.vibe_score === null) return 0;
      if (a.vibe_score === null) return 1;
      if (b.vibe_score === null) return -1;
      return b.vibe_score - a.vibe_score;
    });

    res.json({ success: true, data: scored });
  })
);

/**
 * GET /api/users/:id
 * Get single user profile with Connection Badge.
 */
router.get(
  '/:id',
  validateParamId,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const db = await getDb();
    const user = await db.get(
      `SELECT id, username, display_name, bio, cultural_id, interests, avatar_url,
              is_locked, credits, total_connections, created_at 
       FROM users WHERE id = ? AND is_deleted = 0`,
      [req.params.id]
    );

    if (!user) {
      throw new HttpError('User not found.', 404, 'USER_NOT_FOUND');
    }

    res.json({ success: true, data: user });
  })
);

/**
 * PUT /api/users/:id
 * Update profile (owner only). PII filter applied on bio.
 */
router.put(
  '/:id',
  validateUpdateProfile,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = parseInt(req.params.id as string);

    // Only the owner can update their profile
    if (req.user!.id !== userId) {
      throw new HttpError('You can only edit your own profile.', 403, 'FORBIDDEN');
    }

    const { display_name, bio, cultural_id, interests } = req.body;
    const db = await getDb();

    // PII filter on bio if provided
    let filteredBio = bio;
    let piiDetected = false;
    if (bio) {
      const result = filterPii(bio);
      filteredBio = result.sanitized;
      piiDetected = result.detected;
    }

    // Recompute vibe_vector when bio changes
    let newVibeVector: string | undefined;
    if (filteredBio) {
      try {
        const vec = await computeEmbedding(filteredBio);
        newVibeVector = JSON.stringify(vec);
      } catch (err) {
        console.error('Warning: could not recompute vibe_vector on update:', err);
      }
    }

    await db.run(
      `UPDATE users SET 
        display_name = COALESCE(?, display_name), 
        bio = COALESCE(?, bio), 
        cultural_id = COALESCE(?, cultural_id),
        interests = COALESCE(?, interests),
        vibe_vector = COALESCE(?, vibe_vector)
       WHERE id = ?`,
      [display_name || null, filteredBio || null, cultural_id || null, interests || null, newVibeVector || null, userId]
    );

    const updatedUser = await db.get(
      `SELECT id, username, display_name, bio, cultural_id, interests, avatar_url,
              is_locked, credits, total_connections, created_at 
       FROM users WHERE id = ?`,
      [userId]
    );

    res.json({
      success: true,
      data: {
        user: updatedUser,
        ...(piiDetected && {
          piiWarning: 'Some personal information was redacted from your bio for privacy.',
        }),
      },
    });
  })
);

/**
 * DELETE /api/users/:id
 * Soft delete account (owner only).
 */
router.delete(
  '/:id',
  validateParamId,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = parseInt(req.params.id as string);

    if (req.user!.id !== userId) {
      throw new HttpError('You can only delete your own account.', 403, 'FORBIDDEN');
    }

    const db = await getDb();

    // End any active connections
    const activeConns = await db.all(
      `SELECT id FROM connections 
       WHERE (user_a_id = ? OR user_b_id = ?) AND status = 'active'`,
      [userId, userId]
    );

    for (const conn of activeConns) {
      await db.run(`UPDATE connections SET status = 'ended' WHERE id = ?`, [conn.id]);
    }

    // Unlock any locked partners
    await db.run('UPDATE users SET is_locked = 0 WHERE id IN (SELECT user_a_id FROM connections WHERE user_b_id = ? AND status = \'ended\') OR id IN (SELECT user_b_id FROM connections WHERE user_a_id = ? AND status = \'ended\')', [userId, userId]);

    // Soft delete the user
    await db.run('UPDATE users SET is_deleted = 1, is_locked = 0 WHERE id = ?', [userId]);

    res.json({ success: true, data: { message: 'Account deleted successfully.' } });
  })
);

export default router;

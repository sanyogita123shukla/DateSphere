import { Router } from 'express';
import { getDb } from '../db';
import { asyncHandler, HttpError } from '../middleware/errorHandler';
import { authMiddleware } from '../middleware/auth';
import { validateConnectionRequest, validateConnectionAction, validateParamUserId } from '../middleware/validate';
import { AuthenticatedRequest } from '../types';

const router = Router();

router.use(authMiddleware as any);

/**
 * POST /api/connections/request
 * Send a vibe request. Enforces Intentionality Cap and prevents duplicates.
 */
router.post(
  '/request',
  validateConnectionRequest,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = req.user!.id;
    const { user_b_id } = req.body;

    if (userId === user_b_id) {
      throw new HttpError("You can't send a vibe request to yourself.", 400, 'SELF_REQUEST');
    }

    const db = await getDb();

    // Check requester's credits (Intentionality Cap)
    const me = await db.get('SELECT credits, is_locked FROM users WHERE id = ?', [userId]);

    if (me?.is_locked) {
      throw new HttpError('You are currently in Focus Lock. End your current connection first.', 403, 'FOCUS_LOCKED');
    }

    if (!me || me.credits <= 0) {
      throw new HttpError(
        'Monthly intentional slots exhausted. You have 0 remaining. Quality over quantity.',
        403,
        'CREDITS_EXHAUSTED'
      );
    }

    // Check target exists and is available
    const target = await db.get('SELECT id, is_locked, is_deleted FROM users WHERE id = ?', [user_b_id]);
    if (!target || target.is_deleted) {
      throw new HttpError('User not found.', 404, 'USER_NOT_FOUND');
    }
    if (target.is_locked) {
      throw new HttpError('This person is currently in Focus Lock with someone else.', 409, 'TARGET_LOCKED');
    }

    // Check for duplicate request (either direction)
    const existingRequest = await db.get(
      `SELECT id, status, user_a_id FROM connections 
       WHERE ((user_a_id = ? AND user_b_id = ?) OR (user_a_id = ? AND user_b_id = ?))
       AND status IN ('pending', 'active')`,
      [userId, user_b_id, user_b_id, userId]
    );

    if (existingRequest) {
      if (existingRequest.status === 'active') {
        throw new HttpError('You already have an active connection with this person.', 409, 'ALREADY_CONNECTED');
      }

      // Mutual request detected → auto-accept!
      if (existingRequest.user_a_id === user_b_id) {
        // The target already sent us a request — auto-accept it
        await db.run('BEGIN TRANSACTION');
        try {
          await db.run('UPDATE connections SET status = "active", updated_at = CURRENT_TIMESTAMP WHERE id = ?', [existingRequest.id]);
          await db.run('UPDATE users SET is_locked = 1, credits = MAX(credits - 1, 0), total_connections = total_connections + 1 WHERE id IN (?, ?)', [userId, user_b_id]);
          await db.run('COMMIT');

          res.json({
            success: true,
            data: {
              connection_id: existingRequest.id,
              mutual: true,
              message: 'Mutual interest! You are now in Focus Lock.',
            },
          });
          return;
        } catch (e) {
          await db.run('ROLLBACK');
          throw e;
        }
      }

      throw new HttpError('You already sent a request to this person.', 409, 'DUPLICATE_REQUEST');
    }

    // Create the request
    const result = await db.run(
      'INSERT INTO connections (user_a_id, user_b_id, status) VALUES (?, ?, ?)',
      [userId, user_b_id, 'pending']
    );

    res.status(201).json({
      success: true,
      data: {
        connection_id: result.lastID,
        credits_remaining: me.credits - 0, // Credits only deducted on accept
        message: 'Vibe request sent.',
      },
    });
  })
);

/**
 * POST /api/connections/accept
 * Accept a pending request. Locks both users and deducts credits.
 */
router.post(
  '/accept',
  validateConnectionAction,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = req.user!.id;
    const { connection_id } = req.body;

    const db = await getDb();

    const conn = await db.get('SELECT * FROM connections WHERE id = ? AND status = ?', [connection_id, 'pending']);
    if (!conn) {
      throw new HttpError('Connection request not found or already handled.', 404, 'CONNECTION_NOT_FOUND');
    }

    // Only the receiver can accept
    if (conn.user_b_id !== userId) {
      throw new HttpError('You can only accept requests sent to you.', 403, 'FORBIDDEN');
    }

    // Transaction: accept + lock both users + deduct credits + increment badges
    await db.run('BEGIN TRANSACTION');
    try {
      await db.run(
        'UPDATE connections SET status = "active", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [connection_id]
      );

      await db.run(
        `UPDATE users SET 
          is_locked = 1, 
          credits = MAX(credits - 1, 0), 
          total_connections = total_connections + 1 
         WHERE id IN (?, ?)`,
        [conn.user_a_id, conn.user_b_id]
      );

      await db.run('COMMIT');
    } catch (e) {
      await db.run('ROLLBACK');
      throw e;
    }

    // Get partner info for the response
    const partner = await db.get(
      'SELECT id, display_name, bio, cultural_id, total_connections FROM users WHERE id = ?',
      [conn.user_a_id]
    );

    res.json({
      success: true,
      data: {
        connection_id,
        partner,
        message: 'Connection accepted. Focus Lock activated.',
      },
    });
  })
);

/**
 * POST /api/connections/end
 * End an active connection. Unlocks both users.
 */
router.post(
  '/end',
  validateConnectionAction,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = req.user!.id;
    const { connection_id } = req.body;

    const db = await getDb();

    const conn = await db.get(
      'SELECT * FROM connections WHERE id = ? AND status = ?',
      [connection_id, 'active']
    );

    if (!conn) {
      throw new HttpError('No active connection found.', 404, 'CONNECTION_NOT_FOUND');
    }

    // Only participants can end
    if (conn.user_a_id !== userId && conn.user_b_id !== userId) {
      throw new HttpError('You are not part of this connection.', 403, 'FORBIDDEN');
    }

    await db.run('BEGIN TRANSACTION');
    try {
      await db.run(
        'UPDATE connections SET status = "ended", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [connection_id]
      );
      await db.run(
        'UPDATE users SET is_locked = 0 WHERE id IN (?, ?)',
        [conn.user_a_id, conn.user_b_id]
      );
      await db.run('COMMIT');
    } catch (e) {
      await db.run('ROLLBACK');
      throw e;
    }

    res.json({
      success: true,
      data: { message: 'Connection ended. You are now free to explore the Sphere.' },
    });
  })
);

/**
 * GET /api/connections/pending/:userId
 * List incoming vibe requests.
 */
router.get(
  '/pending/:userId',
  validateParamUserId,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = parseInt(req.params.userId as string);

    // Only the user themselves can view their requests
    if (req.user!.id !== userId) {
      throw new HttpError('You can only view your own requests.', 403, 'FORBIDDEN');
    }

    const db = await getDb();
    const requests = await db.all(
      `SELECT c.id, c.user_a_id, c.created_at,
              u.display_name, u.bio, u.cultural_id, u.total_connections, u.interests
       FROM connections c
       JOIN users u ON c.user_a_id = u.id
       WHERE c.user_b_id = ? AND c.status = 'pending' AND u.is_deleted = 0
       ORDER BY c.created_at DESC`,
      [userId]
    );

    res.json({ success: true, data: requests });
  })
);

/**
 * GET /api/connections/active/:userId
 * Get the user's current active connection with partner info.
 */
router.get(
  '/active/:userId',
  validateParamUserId,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = parseInt(req.params.userId as string);

    const db = await getDb();
    const conn = await db.get(
      `SELECT c.id as connection_id, 
              u.id as partner_id, 
              u.display_name as partner_name, 
              u.bio as partner_bio,
              u.cultural_id as partner_cultural_id,
              u.total_connections as partner_total_connections
       FROM connections c
       JOIN users u ON (c.user_a_id = u.id OR c.user_b_id = u.id)
       WHERE (c.user_a_id = ? OR c.user_b_id = ?) AND c.status = 'active'
       AND u.id != ?`,
      [userId, userId, userId]
    );

    res.json({ success: true, data: conn || null });
  })
);

export default router;

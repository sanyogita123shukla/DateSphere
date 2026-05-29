import { Router } from 'express';
import { getDb } from '../db';
import { asyncHandler, HttpError } from '../middleware/errorHandler';
import { authMiddleware } from '../middleware/auth';
import { validateMessage, validateParamConnectionId } from '../middleware/validate';
import { filterPii } from '../middleware/piiFilter';
import { AuthenticatedRequest } from '../types';

const router = Router();

router.use(authMiddleware as any);

/**
 * POST /api/messages
 * Send a message. Applies PII masking and validates active connection.
 */
router.post(
  '/',
  validateMessage,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = req.user!.id;
    const { connection_id, content } = req.body;

    const db = await getDb();

    // Verify active connection and that the user is a participant
    const conn = await db.get(
      `SELECT * FROM connections WHERE id = ? AND status = 'active'`,
      [connection_id]
    );

    if (!conn) {
      throw new HttpError('No active connection found.', 404, 'CONNECTION_NOT_FOUND');
    }

    if (conn.user_a_id !== userId && conn.user_b_id !== userId) {
      throw new HttpError('You are not part of this connection.', 403, 'FORBIDDEN');
    }

    // PII Masking
    const piiResult = filterPii(content.trim());

    const result = await db.run(
      'INSERT INTO messages (connection_id, sender_id, content, pii_detected) VALUES (?, ?, ?, ?)',
      [connection_id, userId, piiResult.sanitized, piiResult.detected ? 1 : 0]
    );

    const message = await db.get('SELECT * FROM messages WHERE id = ?', [result.lastID]);

    res.status(201).json({
      success: true,
      data: {
        message,
        ...(piiResult.detected && {
          piiWarning: `Personal information detected (${piiResult.types.join(', ')}) and redacted for your safety. Keep it on DateSphere!`,
          piiTypes: piiResult.types,
        }),
      },
    });
  })
);

/**
 * GET /api/messages/:connectionId
 * Get all messages for a connection. Only accessible by participants.
 */
router.get(
  '/:connectionId',
  validateParamConnectionId,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = req.user!.id;
    const connectionId = parseInt(req.params.connectionId as string);

    const db = await getDb();

    // Verify participation
    const conn = await db.get(
      `SELECT * FROM connections WHERE id = ? AND (user_a_id = ? OR user_b_id = ?)`,
      [connectionId, userId, userId]
    );

    if (!conn) {
      throw new HttpError('Connection not found or you are not a participant.', 403, 'FORBIDDEN');
    }

    const messages = await db.all(
      'SELECT * FROM messages WHERE connection_id = ? ORDER BY created_at ASC',
      [connectionId]
    );

    res.json({ success: true, data: messages });
  })
);

export default router;

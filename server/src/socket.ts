import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { getDb } from './db';
import { verifyToken } from './middleware/auth';
import { filterPii } from './middleware/piiFilter';
import { ServerToClientEvents, ClientToServerEvents, JwtPayload } from './types';

/** Map of userId -> Set of socket IDs (supports multiple tabs) */
const onlineUsers = new Map<number, Set<string>>();

export function initializeSocket(httpServer: HttpServer): Server<ClientToServerEvents, ServerToClientEvents> {
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
      methods: ['GET', 'POST'],
    },
  });

  // Authentication middleware for Socket.io
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      const decoded = verifyToken(token);
      (socket as any).user = decoded;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const user = (socket as any).user as JwtPayload;
    console.log(`⚡ Socket connected: ${user.username} (${socket.id})`);

    // Track online status
    if (!onlineUsers.has(user.id)) {
      onlineUsers.set(user.id, new Set());
    }
    onlineUsers.get(user.id)!.add(socket.id);

    // Broadcast online status
    socket.broadcast.emit('user:online', { userId: user.id });

    // ─── Join Room ───────────────────────────────────────
    socket.on('join_room', (connectionId: number) => {
      const roomName = `connection_${connectionId}`;
      socket.join(roomName);
      console.log(`  ${user.username} joined room ${roomName}`);
    });

    // ─── Leave Room ──────────────────────────────────────
    socket.on('leave_room', (connectionId: number) => {
      const roomName = `connection_${connectionId}`;
      socket.leave(roomName);
    });

    // ─── Send Message ────────────────────────────────────
    socket.on('message:send', async (data) => {
      const { connectionId, content } = data;

      try {
        const db = await getDb();

        // Verify active connection
        const conn = await db.get(
          `SELECT * FROM connections WHERE id = ? AND status = 'active' 
           AND (user_a_id = ? OR user_b_id = ?)`,
          [connectionId, user.id, user.id]
        );

        if (!conn) return;

        // PII filter
        const piiResult = filterPii(content.trim());

        // Persist to DB
        const result = await db.run(
          'INSERT INTO messages (connection_id, sender_id, content, pii_detected) VALUES (?, ?, ?, ?)',
          [connectionId, user.id, piiResult.sanitized, piiResult.detected ? 1 : 0]
        );

        const message = await db.get('SELECT * FROM messages WHERE id = ?', [result.lastID]);

        if (message) {
          // Broadcast to the room (including sender for confirmation)
          const roomName = `connection_${connectionId}`;
          io.to(roomName).emit('message:receive', message);
        }
      } catch (err) {
        console.error('Socket message error:', err);
      }
    });

    // ─── Typing Indicators ───────────────────────────────
    socket.on('typing:start', (connectionId: number) => {
      const roomName = `connection_${connectionId}`;
      socket.to(roomName).emit('typing:start', { userId: user.id });
    });

    socket.on('typing:stop', (connectionId: number) => {
      const roomName = `connection_${connectionId}`;
      socket.to(roomName).emit('typing:stop', { userId: user.id });
    });

    // ─── Disconnect ──────────────────────────────────────
    socket.on('disconnect', () => {
      console.log(`⚡ Socket disconnected: ${user.username} (${socket.id})`);

      // Remove from online tracking
      const userSockets = onlineUsers.get(user.id);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          onlineUsers.delete(user.id);
          // Only broadcast offline if no more connections from this user
          socket.broadcast.emit('user:offline', { userId: user.id });
        }
      }
    });
  });

  return io;
}

/**
 * Emit a connection-ended event to a specific room.
 * Called from REST routes when a connection is ended.
 */
export function emitConnectionEnded(io: Server, connectionId: number): void {
  io.to(`connection_${connectionId}`).emit('connection:ended', { connectionId });
}

/**
 * Emit a connection-accepted event to specific user sockets.
 */
export function emitConnectionAccepted(
  io: Server,
  targetUserId: number,
  data: { connectionId: number; partnerId: number; partnerName: string }
): void {
  const targetSockets = onlineUsers.get(targetUserId);
  if (targetSockets) {
    for (const socketId of targetSockets) {
      io.to(socketId).emit('connection:accepted', data);
    }
  }
}

/**
 * Check if a user is currently online.
 */
export function isUserOnline(userId: number): boolean {
  return onlineUsers.has(userId) && onlineUsers.get(userId)!.size > 0;
}

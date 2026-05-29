import { Request } from 'express';

// ─── Database Entities ────────────────────────────────────────

export interface User {
  id: number;
  username: string;
  password: string;
  display_name: string;
  avatar_url: string | null;
  bio: string;
  cultural_id: string;
  vibe_vector: string | null;
  credits: number;
  total_connections: number;
  interests: string | null;
  is_locked: number; // 0 or 1 (SQLite boolean)
  is_deleted: number;
  credits_reset_at: string;
  created_at: string;
}

/** User object without the password hash — safe to send to clients */
export type SafeUser = Omit<User, 'password' | 'is_deleted'>;

export interface Connection {
  id: number;
  user_a_id: number;
  user_b_id: number;
  status: 'pending' | 'active' | 'ended';
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: number;
  connection_id: number;
  sender_id: number;
  content: string;
  pii_detected: number; // 0 or 1
  created_at: string;
}

// ─── API Types ────────────────────────────────────────────────

export interface ApiSuccess<T = unknown> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: string;
  code?: string;
  fields?: Record<string, string>;
}

export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiError;

// ─── JWT ──────────────────────────────────────────────────────

export interface JwtPayload {
  id: number;
  username: string;
}

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

// ─── Socket.io Events ─────────────────────────────────────────

export interface ServerToClientEvents {
  'message:receive': (message: Message) => void;
  'typing:start': (data: { userId: number }) => void;
  'typing:stop': (data: { userId: number }) => void;
  'user:online': (data: { userId: number }) => void;
  'user:offline': (data: { userId: number }) => void;
  'connection:ended': (data: { connectionId: number }) => void;
  'connection:accepted': (data: { connectionId: number; partnerId: number; partnerName: string }) => void;
}

export interface ClientToServerEvents {
  'join_room': (connectionId: number) => void;
  'leave_room': (connectionId: number) => void;
  'message:send': (data: { connectionId: number; content: string }) => void;
  'typing:start': (connectionId: number) => void;
  'typing:stop': (connectionId: number) => void;
}

export interface PiiFilterResult {
  sanitized: string;
  detected: boolean;
  types: string[];
}

// ─── Active Connection (joined query result) ──────────────────

export interface ActiveConnection {
  connection_id: number;
  partner_id: number;
  partner_name: string;
  partner_bio: string;
  partner_cultural_id: string;
  partner_total_connections: number;
}

// ─── Pending Request (joined query result) ────────────────────

export interface PendingRequest {
  id: number;
  user_a_id: number;
  display_name: string;
  bio: string;
  cultural_id: string;
  total_connections: number;
  created_at: string;
}

// ─── Database Entities (Client-safe) ──────────────────────────

export interface User {
  id: number;
  username: string;
  display_name: string;
  bio: string;
  cultural_id: string;
  interests: string | null;
  avatar_url: string | null;
  is_locked: number;
  credits: number;
  total_connections: number;
  created_at: string;
  score?: number;       // Client-only: vibe score for display
  vibe_score?: number;  // Server-returned: semantic similarity score
}

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
  pii_detected: number;
  created_at: string;
}

export interface ActiveConnection {
  connection_id: number;
  partner_id: number;
  partner_name: string;
  partner_bio: string;
  partner_cultural_id: string;
  partner_total_connections: number;
}

export interface PendingRequest {
  id: number;
  user_a_id: number;
  display_name: string;
  bio: string;
  cultural_id: string;
  total_connections: number;
  interests: string;
  created_at: string;
}

// ─── API Response Types ───────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  fields?: Record<string, string>;
}

export interface AuthResponse {
  token: string;
  user: User;
  piiWarning?: string;
}

export interface ConnectionRequestResponse {
  connection_id: number;
  credits_remaining: number;
  message: string;
  mutual?: boolean;
}

export interface ConnectionAcceptResponse {
  connection_id: number;
  partner: User;
  message: string;
}

export interface MessageSendResponse {
  message: Message;
  piiWarning?: string;
  piiTypes?: string[];
}

// ─── Toast Types ──────────────────────────────────────────────

export type ToastVariant = 'success' | 'error' | 'warning' | 'info' | 'pii';

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  duration?: number;
}

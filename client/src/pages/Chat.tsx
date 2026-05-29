import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, Lock, ShieldCheck, Info, Shield } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { api } from '../utils/api';
import { useToast } from '../components/Toast';
import { ConnectionBadge } from '../components/ConnectionBadge';
import type { User, Message, ActiveConnection } from '../types';

interface ChatProps {
  user: User;
  setUser: (user: User | null) => void;
}

const Chat = ({ user, setUser }: ChatProps) => {
  const [partner, setPartner] = useState<ActiveConnection | null>(null);
  const [connectionId, setConnectionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const [isPartnerOnline, setIsPartnerOnline] = useState(true);
  const [connectionEnded, setConnectionEnded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigate = useNavigate();
  const toast = useToast();

  // ─── Scroll to bottom ──────────────────────────────────────
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages, isPartnerTyping]);

  // ─── Unlock and return to dashboard ────────────────────────
  const unlockUser = useCallback(() => {
    const updatedUser = { ...user, is_locked: 0 };
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
    navigate('/dashboard');
  }, [user, setUser, navigate]);

  // ─── Fetch active match ────────────────────────────────────
  const fetchActiveMatch = useCallback(async () => {
    const res = await api.get<ActiveConnection>(`/connections/active/${user.id}`);
    if (res.success && res.data && res.data.connection_id) {
      setPartner(res.data);
      setConnectionId(res.data.connection_id);
    } else {
      unlockUser();
    }
  }, [user.id, unlockUser]);

  // ─── Fetch messages (initial + fallback) ───────────────────
  const fetchMessages = useCallback(async (connId: number) => {
    const res = await api.get<Message[]>(`/messages/${connId}`);
    if (res.success && res.data) {
      setMessages(res.data);
    }
  }, []);

  // ─── Initialize Socket.io ─────────────────────────────────
  useEffect(() => {
    fetchActiveMatch();
  }, [fetchActiveMatch]);

  useEffect(() => {
    if (!connectionId) return;

    // Load initial messages
    fetchMessages(connectionId);

    // Setup Socket.io
    const token = localStorage.getItem('token');
    const socket = io('http://localhost:3000', {
      auth: { token },
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join_room', connectionId);
    });

    // Real-time message reception
    socket.on('message:receive' as any, (message: Message) => {
      setMessages((prev) => {
        // Prevent duplicates
        if (prev.some((m) => m.id === message.id)) return prev;
        return [...prev, message];
      });

      // Show PII warning if this user sent a PII-containing message
      if (message.sender_id === user.id && message.pii_detected) {
        toast.pii('Personal info was redacted for privacy. Keep it on DateSphere!');
      }
    });

    // Typing indicators
    socket.on('typing:start' as any, () => setIsPartnerTyping(true));
    socket.on('typing:stop' as any, () => setIsPartnerTyping(false));

    // Online status
    socket.on('user:online' as any, (data: { userId: number }) => {
      if (partner && data.userId === partner.partner_id) {
        setIsPartnerOnline(true);
      }
    });
    socket.on('user:offline' as any, (data: { userId: number }) => {
      if (partner && data.userId === partner.partner_id) {
        setIsPartnerOnline(false);
      }
    });

    // Connection ended by partner
    socket.on('connection:ended' as any, () => {
      setConnectionEnded(true);
      toast.info('Your partner has ended the connection.');
    });

    return () => {
      socket.emit('leave_room', connectionId);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [connectionId, user.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Send message ──────────────────────────────────────────
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !connectionId) return;

    const content = newMessage.trim();
    setNewMessage('');

    // Send via Socket.io for real-time delivery
    if (socketRef.current?.connected) {
      socketRef.current.emit('message:send', {
        connectionId,
        content,
      });
    } else {
      // Fallback to REST
      const res = await api.post<{ message: Message; piiWarning?: string }>('/messages', {
        connection_id: connectionId,
        content,
      });

      if (res.success && res.data) {
        setMessages((prev) => [...prev, res.data!.message]);
        if (res.data.piiWarning) {
          toast.pii(res.data.piiWarning);
        }
      }
    }

    // Stop typing indicator
    if (socketRef.current?.connected) {
      socketRef.current.emit('typing:stop', connectionId);
    }
  };

  // ─── Typing indicator ─────────────────────────────────────
  const handleTyping = (value: string) => {
    setNewMessage(value);

    if (!socketRef.current?.connected || !connectionId) return;

    socketRef.current.emit('typing:start', connectionId);

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Stop typing after 2 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      socketRef.current?.emit('typing:stop', connectionId);
    }, 2000);
  };

  // ─── End connection ────────────────────────────────────────
  const handleEndConnection = async () => {
    if (!window.confirm('End this connection? Both you and your partner will be unlocked.')) return;

    const res = await api.post('/connections/end', {
      connection_id: connectionId,
    });

    if (res.success) {
      // Notify partner via socket
      if (socketRef.current?.connected && connectionId) {
        socketRef.current.emit('leave_room', connectionId);
      }
      toast.info('Connection ended.');
      unlockUser();
    } else {
      toast.error(res.error || 'Failed to end connection.');
    }
  };

  // ─── Time formatting ──────────────────────────────────────
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // ─── Loading state ─────────────────────────────────────────
  if (!partner) {
    return (
      <div className="focus-lock-loading">
        <div className="bg-orb bg-orb-purple" />
        <div className="focus-lock-content">
          <div className="sphere-glow" style={{ marginBottom: '2rem' }}>
            <Lock size={64} color="var(--accent-pink)" />
          </div>
          <h2 className="focus-lock-title text-gradient">Initializing Focus Lock...</h2>
          <p className="focus-lock-subtitle">Securing your private tunnel.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-page">
      <div className="bg-orb bg-orb-pink" style={{ opacity: 0.04, top: '10%', right: '10%' }} />
      <div className="bg-orb bg-orb-blue" style={{ opacity: 0.04, bottom: '10%', left: '10%' }} />

      {/* Connection Ended Overlay */}
      {connectionEnded && (
        <div className="chat-ended-overlay">
          <Lock size={48} color="var(--text-secondary)" style={{ marginBottom: '1.5rem' }} />
          <h2 className="text-gradient" style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>
            Connection Ended
          </h2>
          <p className="text-muted" style={{ marginBottom: '2rem' }}>
            Your partner ended this connection.
          </p>
          <button className="btn-primary" onClick={unlockUser}>
            Return to Sphere
          </button>
        </div>
      )}

      {/* Header */}
      <header className="glass-panel-fixed chat-header">
        <div className="chat-partner-info">
          <div className="chat-avatar">
            {partner.partner_name[0]}
            <div className={`online-dot ${isPartnerOnline ? '' : 'offline'}`} />
          </div>
          <div>
            <h3 className="chat-partner-name">{partner.partner_name}</h3>
            <div className="chat-partner-status">
              <ShieldCheck size={14} />
              Focus Lock Active
              <span style={{ margin: '0 6px', opacity: 0.3 }}>•</span>
              <ConnectionBadge count={partner.partner_total_connections} size="sm" />
            </div>
          </div>
        </div>
        <button id="btn-end-connection" className="chat-end-btn" onClick={handleEndConnection}>
          End Connection
        </button>
      </header>

      {/* Info Banner */}
      <div className="chat-info-banner">
        <Info size={16} color="var(--accent-blue)" />
        <span>Focus Lock active — browse is disabled. Give this connection your full attention.</span>
        <Shield size={14} color="var(--accent-purple)" style={{ marginLeft: 'auto', flexShrink: 0 }} />
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="chat-messages">
        {messages.length === 0 && !isPartnerTyping ? (
          <div className="chat-empty">
            <p className="chat-empty-bio">"{partner.partner_bio}"</p>
            <p className="chat-empty-cta">Initiate the first spark...</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_id === user.id;
            return (
              <div
                key={msg.id}
                className={`message-row ${isMe ? 'message-row-sent' : 'message-row-received'}`}
              >
                <div className={`message-bubble ${isMe ? 'message-sent' : 'message-received'}`}>
                  {msg.content}
                  <div className="message-timestamp">{formatTime(msg.created_at)}</div>
                  {msg.pii_detected === 1 && (
                    <div className="message-pii-indicator">
                      <Shield size={10} /> Content filtered
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Typing Indicator */}
        {isPartnerTyping && (
          <div className="message-row message-row-received">
            <div className="typing-indicator">
              <div className="typing-dot" />
              <div className="typing-dot" />
              <div className="typing-dot" />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSendMessage} className="chat-input-area">
        <div className="glass-panel-fixed chat-input-wrapper">
          <input
            id="chat-message-input"
            type="text"
            value={newMessage}
            onChange={(e) => handleTyping(e.target.value)}
            placeholder="Type your intentional message..."
            className="chat-input"
            autoComplete="off"
            disabled={connectionEnded}
          />
          <button
            id="chat-send-btn"
            type="submit"
            className="chat-send-btn"
            disabled={!newMessage.trim() || connectionEnded}
          >
            <Send size={18} style={{ marginLeft: '2px' }} />
          </button>
        </div>
      </form>
    </div>
  );
};

export default Chat;

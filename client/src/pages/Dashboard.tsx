import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Globe, User as UserIcon, Bell, LogOut, Trash2, Edit3, X, Sparkles, Zap } from 'lucide-react';
import { api } from '../utils/api';
import { useToast } from '../components/Toast';
import { SkeletonCard } from '../components/SkeletonCard';
import { ConnectionBadge } from '../components/ConnectionBadge';
import { CreditCounter } from '../components/CreditCounter';
import type { User, PendingRequest, ConnectionRequestResponse, ConnectionAcceptResponse } from '../types';

interface DashboardProps {
  user: User;
  setUser: (user: User | null) => void;
}

type Tab = 'sphere' | 'requests' | 'profile';

const Dashboard = ({ user, setUser }: DashboardProps) => {
  const [users, setUsers] = useState<User[]>([]);
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingAI, setLoadingAI] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('sphere');

  const [editMode, setEditMode] = useState(false);
  const [editProfile, setEditProfile] = useState({
    display_name: user?.display_name || '',
    bio: user?.bio || '',
    cultural_id: user?.cultural_id || '',
    interests: user?.interests || '',
  });
  const [sentRequests, setSentRequests] = useState<Set<number>>(new Set());
  const [vibeComputed, setVibeComputed] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  // ─── Data Fetching ──────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    const res = await api.get<User[]>('/users');
    if (res.success && res.data) {
      setUsers(res.data);
    }
    setLoadingUsers(false);
  }, []);

  const fetchRequests = useCallback(async () => {
    const res = await api.get<PendingRequest[]>(`/connections/pending/${user.id}`);
    if (res.success && res.data) {
      setRequests(res.data);
    }
  }, [user.id]);



  const checkActiveMatch = useCallback(async () => {
    const res = await api.get<any>(`/connections/active/${user.id}`);
    if (res.success && res.data && res.data.connection_id) {
      const updatedUser = { ...user, is_locked: 1 };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
      navigate('/chat');
    }
  }, [user, setUser, navigate]);

  useEffect(() => {
    fetchUsers();
    fetchRequests();

    const interval = setInterval(() => {
      checkActiveMatch();
      fetchRequests();
    }, 3000);
    return () => clearInterval(interval);
  }, [fetchUsers, fetchRequests, checkActiveMatch]);

  // ─── Server-Side Vibe Matching ─────────────────────────────
  /**
   * Calls GET /api/users/vibe-matches — server computes cosine similarity
   * from stored bio embeddings. No browser WASM download needed.
   */
  const computeVibeMatches = async () => {
    setLoadingAI(true);
    try {
      const res = await api.get<User[]>('/users/vibe-matches');
      if (res.success && res.data) {
        // Map vibe_score to score for display compatibility
        const scored = res.data.map((u: any) => ({
          ...u,
          score: u.vibe_score ?? undefined,
        }));
        setUsers(scored);
        setVibeComputed(true);
        toast.success('Vibe compatibility scores loaded.');
      } else {
        toast.error(res.error || 'Could not compute vibe matches.');
      }
    } catch {
      toast.error('Server error while computing vibe matches.');
    }
    setLoadingAI(false);
  };

  // ─── Actions ────────────────────────────────────────────────
  const handleVibeRequest = async (targetId: number) => {
    const res = await api.post<ConnectionRequestResponse>('/connections/request', {
      user_b_id: targetId,
    });

    if (res.success && res.data) {
      setSentRequests((prev) => new Set(prev).add(targetId));
      if (res.data.mutual) {
        toast.success(res.data.message);
        checkActiveMatch();
      } else {
        toast.success('Vibe Request sent.');
      }
      const userRes = await api.get<User>(`/users/${user.id}`);
      if (userRes.success && userRes.data) {
        setUser(userRes.data);
        localStorage.setItem('user', JSON.stringify(userRes.data));
      }
    } else {
      toast.error(res.error || 'Failed to send request.');
    }
  };

  const handleAcceptRequest = async (connectionId: number) => {
    const res = await api.post<ConnectionAcceptResponse>('/connections/accept', {
      connection_id: connectionId,
    });

    if (res.success) {
      toast.success('Connection accepted. Entering Focus Lock…');
      checkActiveMatch();
    } else {
      toast.error(res.error || 'Failed to accept request.');
    }
  };

  const handleUpdateProfile = async () => {
    const res = await api.put<{ user: User; piiWarning?: string }>(`/users/${user.id}`, editProfile);

    if (res.success && res.data) {
      const updatedUser = res.data.user;
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setEditMode(false);

      if (res.data.piiWarning) toast.pii(res.data.piiWarning);
      toast.success('Profile updated.');
    } else {
      toast.error(res.error || 'Failed to update profile.');
    }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm('Delete your account? This cannot be undone.')) return;

    const res = await api.delete(`/users/${user.id}`);
    if (res.success) {
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      setUser(null);
      navigate('/');
      toast.info('Account deleted.');
    } else {
      toast.error(res.error || 'Failed to delete account.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    setUser(null);
    navigate('/');
  };

  // ─── Render ─────────────────────────────────────────────────
  return (
    <div className="dashboard-layout">

      {/* Sidebar — editorial left rail */}
      <nav className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-brand-name">DateSphere</div>
          <div className="sidebar-brand-tagline">Intentional only</div>
        </div>

        <button
          id="nav-sphere"
          className={`nav-btn ${activeTab === 'sphere' ? 'active' : ''}`}
          onClick={() => setActiveTab('sphere')}
        >
          <Globe size={16} /> The Sphere
        </button>

        <button
          id="nav-requests"
          className={`nav-btn ${activeTab === 'requests' ? 'active' : ''}`}
          onClick={() => setActiveTab('requests')}
        >
          <Bell size={16} /> Requests
          {requests.length > 0 && <span className="nav-badge">{requests.length}</span>}
        </button>

        <button
          id="nav-profile"
          className={`nav-btn ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          <UserIcon size={16} /> My Profile
        </button>

        <div className="sidebar-footer">
          <button id="nav-logout" className="nav-btn" onClick={handleLogout}>
            <LogOut size={16} /> Disconnect
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="dashboard-main">

        {/* ─── Sphere (Discovery) Tab ───────────────────────── */}
        {activeTab === 'sphere' && (
          <div className="dashboard-content fade-in">
            <div className="dashboard-header">
              <div className="dashboard-header-left">
                <p className="dashboard-header-overline">Discovery</p>
                <h1>Orbiting Near You</h1>
                <p className="dashboard-header-sub">
                  Intentional connections only.{' '}
                  {user.credits === 1 ? '1 slot remaining.' : `${user.credits} slots remaining.`}
                </p>
              </div>
              <CreditCounter credits={user.credits} />
            </div>

            {/* Vibe Match Banner */}
            <div className="ai-banner">
              <div className="ai-banner-text">
                <h3>
                  {vibeComputed ? 'Sorted by Vibe Compatibility' : 'Vibe Compatibility'}
                </h3>
                <p>
                  {vibeComputed
                    ? 'Profiles ranked by semantic similarity to your bio. The closer the match, the more your essences align.'
                    : 'Let the server rank every profile by how closely your bio aligns — powered by a sentence-similarity model, computed in seconds.'}
                </p>
              </div>
              <button
                id="btn-ai-vibe"
                onClick={computeVibeMatches}
                disabled={loadingAI}
                className="btn-primary"
              >
                {loadingAI ? (
                  <>
                    <Zap size={16} style={{ opacity: 0.7 }} />
                    Computing…
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    {vibeComputed ? 'Re-rank Vibes' : 'Rank by Vibe'}
                  </>
                )}
              </button>
            </div>

            {/* Card Grid */}
            <div className="card-grid">
              {loadingUsers ? (
                <SkeletonCard variant="profile" count={4} />
              ) : users.length === 0 ? (
                <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
                  <div className="empty-state-icon">○</div>
                  <div className="empty-state-title">The Sphere is Quiet</div>
                  <div className="empty-state-text">
                    All members are currently in Focus Lock. Good things take time.
                  </div>
                </div>
              ) : (
                users.map((u, idx) => (
                  <div
                    key={u.id}
                    className="glass-panel profile-card fade-in"
                    style={{ animationDelay: `${idx * 0.07}s`, opacity: 0 }}
                  >
                    <div className="profile-card-header">
                      <h3 className="profile-card-name">{u.display_name}</h3>
                      {u.cultural_id && (
                        <span className="profile-card-cultural">{u.cultural_id}</span>
                      )}
                    </div>

                    <p className="profile-card-bio">"{u.bio}"</p>

                    {u.interests && (
                      <div className="profile-card-interests">
                        {u.interests.split(',').slice(0, 4).map((tag) => (
                          <span key={tag.trim()} className="interest-tag">
                            {tag.trim()}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="profile-card-footer">
                      <ConnectionBadge count={u.total_connections} size="sm" />
                    </div>

                    {u.score !== undefined && u.score !== null && (
                      <div className="vibe-score">
                        <div className="vibe-score-header">
                          <span className="vibe-score-label">Vibe Match</span>
                          <span className="vibe-score-value">{(u.score * 100).toFixed(0)}%</span>
                        </div>
                        <div className="vibe-score-bar">
                          <div
                            className="vibe-score-fill"
                            style={{ width: `${u.score * 100}%` }}
                          />
                        </div>
                      </div>
                    )}

                    <button
                      id={`vibe-request-${u.id}`}
                      onClick={() => handleVibeRequest(u.id)}
                      className="btn-primary"
                      disabled={sentRequests.has(u.id) || user.credits <= 0}
                    >
                      {sentRequests.has(u.id)
                        ? '✓ Request Sent'
                        : user.credits <= 0
                          ? 'No Slots Left'
                          : 'Send Vibe Request'}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ─── Requests Tab ─────────────────────────────────── */}
        {activeTab === 'requests' && (
          <div className="dashboard-content fade-in">
            <div className="dashboard-header" style={{ marginBottom: '2rem' }}>
              <div className="dashboard-header-left">
                <p className="dashboard-header-overline">Incoming</p>
                <h1>Pending Requests</h1>
                <p className="dashboard-header-sub">
                  Someone wants to enter Focus Lock with you.
                </p>
              </div>
            </div>

            {requests.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">◯</div>
                <div className="empty-state-title">No Pending Requests</div>
                <div className="empty-state-text">
                  When someone sends you a vibe request, it will appear here.
                  Quality connections take time.
                </div>
              </div>
            ) : (
              <div className="requests-list">
                {requests.map((req) => (
                  <div key={req.id} className="request-card">
                    <div className="request-card-info">
                      <h3>
                        {req.display_name}
                        <span>wants to enter Focus Lock</span>
                      </h3>
                      <p>"{req.bio}"</p>
                      <div style={{ marginTop: '0.5rem' }}>
                        <ConnectionBadge count={req.total_connections} size="sm" />
                      </div>
                      {req.interests && (
                        <div className="profile-card-interests" style={{ marginTop: '0.6rem' }}>
                          {req.interests.split(',').slice(0, 3).map((tag) => (
                            <span key={tag.trim()} className="interest-tag">{tag.trim()}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      id={`accept-request-${req.id}`}
                      onClick={() => handleAcceptRequest(req.id)}
                      className="btn-primary"
                    >
                      Accept & Lock
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── Profile Tab ──────────────────────────────────── */}
        {activeTab === 'profile' && (
          <div className="profile-section fade-in">
            <p className="dashboard-header-overline" style={{ marginBottom: '0.5rem' }}>Your Identity</p>
            <h2>My Profile</h2>

            <div className="glass-panel-static" style={{ padding: '2rem', marginBottom: '1.5rem' }}>
              {!editMode ? (
                <>
                  <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start' }}>
                    <div className="profile-avatar">
                      {user.display_name?.[0]?.toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.5rem', letterSpacing: '-0.03em', margin: '0 0 0.2rem' }}>
                            {user.display_name}
                          </h3>
                          <p className="overline" style={{ color: 'var(--text-muted)' }}>@{user.username}</p>
                        </div>
                        <button className="btn-ghost" onClick={() => setEditMode(true)}>
                          <Edit3 size={14} /> Edit
                        </button>
                      </div>
                      {user.cultural_id && (
                        <span className="profile-card-cultural" style={{ marginTop: '0.75rem', display: 'inline-block' }}>
                          {user.cultural_id}
                        </span>
                      )}
                      <p style={{ color: 'var(--text-secondary)', marginTop: '1rem', lineHeight: 1.75, fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: '0.95rem' }}>
                        {user.bio}
                      </p>
                      {user.interests && (
                        <div className="profile-card-interests" style={{ marginTop: '1rem' }}>
                          {user.interests.split(',').map((tag) => (
                            <span key={tag.trim()} className="interest-tag">{tag.trim()}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="profile-stats">
                    <div className="profile-stat">
                      <span className="profile-stat-value">{user.total_connections}</span>
                      <span className="profile-stat-label">Connections</span>
                    </div>
                    <div className="profile-stat">
                      <span className="profile-stat-value">{user.credits}</span>
                      <span className="profile-stat-label">Slots Left</span>
                    </div>
                    <div className="profile-stat">
                      <span className="profile-stat-value">
                        {new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                      </span>
                      <span className="profile-stat-label">Member Since</span>
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.25rem', letterSpacing: '-0.02em', margin: 0 }}>
                      Edit Profile
                    </h3>
                    <button className="btn-icon" onClick={() => setEditMode(false)}>
                      <X size={18} />
                    </button>
                  </div>

                  <div className="field-group">
                    <label className="field-label">Display Name</label>
                    <input
                      type="text"
                      value={editProfile.display_name}
                      onChange={(e) => setEditProfile({ ...editProfile, display_name: e.target.value })}
                      className="input-premium"
                    />
                  </div>

                  <div className="field-group">
                    <label className="field-label">Cultural Identity</label>
                    <input
                      type="text"
                      value={editProfile.cultural_id}
                      onChange={(e) => setEditProfile({ ...editProfile, cultural_id: e.target.value })}
                      className="input-premium"
                    />
                  </div>

                  <div className="field-group">
                    <label className="field-label">Interests (comma separated)</label>
                    <input
                      type="text"
                      value={editProfile.interests}
                      onChange={(e) => setEditProfile({ ...editProfile, interests: e.target.value })}
                      className="input-premium"
                    />
                  </div>

                  <div className="field-group">
                    <label className="field-label">Bio — used for Vibe Matching</label>
                    <textarea
                      value={editProfile.bio}
                      onChange={(e) => setEditProfile({ ...editProfile, bio: e.target.value })}
                      className="input-premium"
                      style={{ minHeight: '120px' }}
                    />
                  </div>

                  <button className="btn-primary" onClick={handleUpdateProfile} style={{ marginTop: '0.25rem' }}>
                    Save Changes
                  </button>
                </div>
              )}
            </div>

            {/* Danger Zone */}
            <div className="glass-panel-static profile-danger-zone">
              <h3>Danger Zone</h3>
              <p className="text-muted text-sm">
                Permanently erase your identity and connection history from the Sphere.
              </p>
              <button
                id="btn-delete-account"
                className="btn-danger"
                onClick={handleDeleteAccount}
                style={{ marginTop: '1rem' }}
              >
                <Trash2 size={14} /> Terminate Account
              </button>
            </div>
          </div>
        )}


      </main>
    </div>
  );
};

export default Dashboard;

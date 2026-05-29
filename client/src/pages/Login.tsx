import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Sparkles, Lock, Heart } from 'lucide-react';
import { useToast } from '../components/Toast';
import { api } from '../utils/api';
import type { User, AuthResponse } from '../types';

interface LoginProps {
  setUser: (user: User | null) => void;
}

const Login = ({ setUser }: LoginProps) => {
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [culturalId, setCulturalId] = useState('');
  const [interests, setInterests] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const navigate = useNavigate();
  const toast = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    const endpoint = isRegister ? '/auth/register' : '/auth/login';
    const payload = isRegister
      ? { username, password, display_name: displayName, bio, cultural_id: culturalId, interests }
      : { username, password };

    const res = await api.post<AuthResponse>(endpoint, payload);
    setLoading(false);

    if (res.success && res.data) {
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      setUser(res.data.user);

      if (res.data.piiWarning) toast.pii(res.data.piiWarning);
      toast.success(isRegister ? 'Welcome to the Sphere.' : 'Welcome back.');
      navigate('/dashboard');
    } else {
      if (res.fields) setErrors(res.fields);
      toast.error(res.error || 'Something went wrong. Please try again.');
    }
  };

  const toggleMode = () => {
    setIsRegister(!isRegister);
    setErrors({});
  };

  return (
    <div className="login-page">
      {/* Left — Editorial Hero */}
      <div className="login-hero">
        {/* Decorative watermark number */}
        <div className="login-hero-watermark" aria-hidden="true">DS</div>

        <div className="fade-in delay-1" style={{ position: 'relative', zIndex: 2 }}>
          {/* Overline */}
          <div className="login-hero-overline">
            Est. {new Date().getFullYear()} — Intentional Only
          </div>

          {/* Massive left-aligned headline */}
          <h1 className="login-hero-title">
            Love<br />
            takes<br />
            <em>intention.</em>
          </h1>

          {/* Body copy — constrained measure */}
          <p className="login-hero-body">
            We eliminated infinite swiping. DateSphere gives you five
            connection slots a month — no more, no less. Every conversation
            earns its place here.
          </p>

          {/* Feature pills — horizontal, not a grid */}
          <div className="login-features">
            <span className="login-feature">
              <Shield size={13} style={{ color: 'var(--accent-rose)' }} />
              Privacy First
            </span>
            <span className="login-feature">
              <Sparkles size={13} style={{ color: 'var(--accent-amber)' }} />
              AI Vibe Match
            </span>
            <span className="login-feature">
              <Lock size={13} style={{ color: 'var(--text-muted)' }} />
              Focus Lock
            </span>
            <span className="login-feature">
              <Heart size={13} style={{ color: 'var(--accent-rose-lt)' }} />
              No Infinite Swipes
            </span>
          </div>
        </div>
      </div>

      {/* Right — Compact Form Panel */}
      <div className="login-form-side">
        <div className="login-form-card fade-in delay-2">

          <p className="overline" style={{ marginBottom: '0.75rem', color: 'var(--accent-rose)' }}>
            DateSphere
          </p>

          <h2 className="login-form-heading">
            {isRegister ? 'Join the Sphere' : 'Welcome back'}
          </h2>
          <p className="login-form-sub">
            {isRegister
              ? 'Create your identity. Five slots await.'
              : 'Your intentional connections are waiting.'}
          </p>

          <form onSubmit={handleSubmit} className="login-form">
            <div className="field-group">
              <input
                id="login-username"
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={`input-premium ${errors.username ? 'input-error' : ''}`}
                required
                autoComplete="username"
              />
              {errors.username && <div className="input-error-text">{errors.username}</div>}
            </div>

            <div className="field-group">
              <input
                id="login-password"
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`input-premium ${errors.password ? 'input-error' : ''}`}
                required
                autoComplete={isRegister ? 'new-password' : 'current-password'}
              />
              {errors.password && <div className="input-error-text">{errors.password}</div>}
            </div>

            {isRegister && (
              <>
                <div className="login-divider">also</div>

                <div className="field-group">
                  <label className="field-label" htmlFor="register-displayname">Display Name</label>
                  <input
                    id="register-displayname"
                    type="text"
                    placeholder="How you appear in the Sphere"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className={`input-premium ${errors.display_name ? 'input-error' : ''}`}
                    required
                  />
                  {errors.display_name && <div className="input-error-text">{errors.display_name}</div>}
                </div>

                <div className="field-group">
                  <label className="field-label" htmlFor="register-bio">Your Essence — for Vibe Matching</label>
                  <textarea
                    id="register-bio"
                    placeholder="Write honestly. This is what the AI reads to find your matches…"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className={`input-premium ${errors.bio ? 'input-error' : ''}`}
                    style={{ minHeight: '96px' }}
                    required
                  />
                  {errors.bio && <div className="input-error-text">{errors.bio}</div>}
                </div>

                <div className="field-group">
                  <label className="field-label" htmlFor="register-cultural">Cultural Background</label>
                  <input
                    id="register-cultural"
                    type="text"
                    placeholder="e.g. Kashmiri, Latino, Korean…"
                    value={culturalId}
                    onChange={(e) => setCulturalId(e.target.value)}
                    className="input-premium"
                  />
                </div>

                <div className="field-group">
                  <label className="field-label" htmlFor="register-interests">Interests</label>
                  <input
                    id="register-interests"
                    type="text"
                    placeholder="poetry, coffee, marine biology…"
                    value={interests}
                    onChange={(e) => setInterests(e.target.value)}
                    className="input-premium"
                  />
                </div>
              </>
            )}

            <button
              id="login-submit"
              type="submit"
              className="btn-primary"
              disabled={loading}
              style={{ marginTop: '0.25rem' }}
            >
              {loading
                ? 'Connecting…'
                : isRegister
                  ? 'Enter the Sphere'
                  : 'Continue'}
            </button>
          </form>

          <p className="login-toggle" onClick={toggleMode} style={{ marginTop: '1.5rem' }}>
            {isRegister ? (
              <span>Already inside? <strong>Sign in</strong></span>
            ) : (
              <span>First time here? <strong>Create identity</strong></span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;

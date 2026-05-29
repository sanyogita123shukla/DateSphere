import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Chat from './pages/Chat';
import type { User } from './types';
import { api } from './utils/api';
import './index.css';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const storedUser = localStorage.getItem('user');
      const token = localStorage.getItem('token');

      if (storedUser && token) {
        try {
          const parsed = JSON.parse(storedUser);
          // Verify token is still valid by fetching fresh user data
          const res = await api.get<User>(`/users/${parsed.id}`);
          if (res.success && res.data) {
            setUser(res.data);
            localStorage.setItem('user', JSON.stringify(res.data));
          } else {
            // Token expired or invalid
            localStorage.removeItem('user');
            localStorage.removeItem('token');
          }
        } catch {
          localStorage.removeItem('user');
          localStorage.removeItem('token');
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'var(--bg-primary)',
        flexDirection: 'column',
        gap: '0.75rem',
      }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.04em', color: 'var(--text-primary)' }}>
          DateSphere
        </div>
        <div className="overline" style={{ color: 'var(--accent-rose)' }}>Loading…</div>
      </div>
    );
  }

  return (
    <ToastProvider>
      <Router>
        <div className="app-container">
          <Routes>
            <Route
              path="/"
              element={user ? <Navigate to="/dashboard" /> : <Login setUser={setUser} />}
            />
            <Route
              path="/dashboard"
              element={
                user ? (
                  user.is_locked ? (
                    <Navigate to="/chat" />
                  ) : (
                    <Dashboard user={user} setUser={setUser} />
                  )
                ) : (
                  <Navigate to="/" />
                )
              }
            />
            <Route
              path="/chat"
              element={
                user ? (
                  user.is_locked ? (
                    <Chat user={user} setUser={setUser} />
                  ) : (
                    <Navigate to="/dashboard" />
                  )
                ) : (
                  <Navigate to="/" />
                )
              }
            />
          </Routes>
        </div>
      </Router>
    </ToastProvider>
  );
}

export default App;

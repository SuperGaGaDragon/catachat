import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getToken, saveToken, api } from '../api';
import './LoginPage.css';

interface LoginResponse {
  access_token: string;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (getToken()) navigate('/', { replace: true });
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post<LoginResponse>('/auth/login/json', { identifier, password });
      saveToken(res.access_token, remember);
      navigate('/', { replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      setError(msg === 'UNAUTHORIZED' ? 'Invalid credentials' : msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-root">
      <div className="login-card">
        <div className="login-brand">
          <span className="login-brand-cata">cata</span>
          <span className="login-brand-chat">chat</span>
        </div>
        <p className="login-subtitle">Sign in with your catachess account</p>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-field">
            <label htmlFor="identifier">Username or email</label>
            <input
              id="identifier"
              type="text"
              autoComplete="username"
              value={identifier}
              onChange={e => setIdentifier(e.target.value)}
              placeholder="Enter your username or email"
              required
              disabled={loading}
            />
          </div>

          <div className="login-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              disabled={loading}
            />
          </div>

          <label className="login-remember">
            <input
              type="checkbox"
              checked={remember}
              onChange={e => setRemember(e.target.checked)}
            />
            Keep me signed in
          </label>

          {error && <div className="login-error">{error}</div>}

          <button className="login-btn" type="submit" disabled={loading || !identifier || !password}>
            {loading ? <span className="login-spinner" /> : 'Sign in'}
          </button>
        </form>

        <div className="login-footer">
          Don't have an account?{' '}
          <a href="https://catachess.com" target="_blank" rel="noopener noreferrer">
            Register on catachess.com
          </a>
        </div>
      </div>
    </div>
  );
}

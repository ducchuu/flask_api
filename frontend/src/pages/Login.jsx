import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthCard from '../components/AuthCard';
import api from '../api/client';
import { useAuth } from '../auth/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [fields, setFields] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function handleChange(e) {
    setFields(prev => ({ ...prev, [e.target.name]: e.target.value }));
    if (error) setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const data = await api.post('/api/tokens', {
        username: fields.username,
        password: fields.password,
      });
      login(data.token, data.user);
      navigate('/feed', { replace: true });
    } catch (err) {
      if (err.code === 'UNAUTHORIZED') {
        setError('Invalid username or password');
      } else {
        setError(err.message || 'Something went wrong, please try again');
      }
    } finally {
      setSubmitting(false);
    }
  }

  const footer = (
    <p>
      Don&apos;t have an account?{' '}
      <Link to="/register">Sign up</Link>
    </p>
  );

  return (
    <AuthCard title="Welcome back" footer={footer}>
      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="auth-form__field">
          <label htmlFor="username">Username</label>
          <input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            value={fields.username}
            onChange={handleChange}
            required
          />
        </div>
        <div className="auth-form__field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={fields.password}
            onChange={handleChange}
            required
          />
        </div>
        {error && <p className="auth-form__error" role="alert">{error}</p>}
        <button type="submit" className="auth-form__submit" disabled={submitting}>
          {submitting ? <span className="spinner" aria-label="Logging in…" /> : 'Log in'}
        </button>
      </form>
    </AuthCard>
  );
}

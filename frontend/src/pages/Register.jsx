import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthCard from '../components/AuthCard';
import api from '../api/client';
import { useAuth } from '../auth/AuthContext';

export default function Register() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [fields, setFields] = useState({ username: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function handleChange(e) {
    setFields(prev => ({ ...prev, [e.target.name]: e.target.value }));
    if (error) setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (fields.password !== fields.confirm) {
      setError('Passwords do not match');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const data = await api.post('/api/users', {
        username: fields.username,
        password: fields.password,
      });
      login(data.token, data.user);
      navigate('/onboarding', { replace: true });
    } catch (err) {
      if (err.code === 'CONFLICT') {
        setError('Username already taken');
      } else {
        setError(err.message || 'Something went wrong, please try again');
      }
    } finally {
      setSubmitting(false);
    }
  }

  const footer = (
    <p>
      Already have an account?{' '}
      <Link to="/login">Log in</Link>
    </p>
  );

  return (
    <AuthCard title="Create account" footer={footer}>
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
            autoComplete="new-password"
            value={fields.password}
            onChange={handleChange}
            required
          />
        </div>
        <div className="auth-form__field">
          <label htmlFor="confirm">Confirm password</label>
          <input
            id="confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            value={fields.confirm}
            onChange={handleChange}
            required
          />
        </div>
        {error && <p className="auth-form__error" role="alert">{error}</p>}
        <button type="submit" className="auth-form__submit" disabled={submitting}>
          {submitting ? <span className="spinner" aria-label="Creating account…" /> : 'Create account'}
        </button>
      </form>
    </AuthCard>
  );
}

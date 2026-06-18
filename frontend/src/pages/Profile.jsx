import { useEffect, useRef, useState } from 'react';
import ThemeToggle from '../components/ThemeToggle';
import api from '../api/client';
import '../styles/library.css';  // .btn .btn--primary
import '../styles/profile.css';

// ── Defaults match backend/services/pipeline.py ───────────────────────────────

const DEFAULT_WEIGHTS = { interest: 0.4, recency: 0.3, popularity: 0.2, source: 0.1 };
const DEFAULT_SOURCE_PREFS = { news: 0.8, video: 0.5, discussion: 0.7 };

function fmtDate(raw) {
  const d = new Date(raw.replace(' ', 'T'));
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ── "✓ Saved" indicator — mounts fresh on each save so animation restarts ────

function SavedIndicator({ onDone }) {
  return (
    <span className="profile-saved" onAnimationEnd={onDone}>
      ✓ Saved
    </span>
  );
}

// ── Generic range slider ──────────────────────────────────────────────────────

function Slider({ label, value, onChange, onCommit }) {
  const pct = `${Math.round(value * 100)}%`;
  return (
    <div className="profile-slider">
      <div className="profile-slider__header">
        <span className="profile-slider__label">{label}</span>
        <span className="profile-slider__value">{value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min="0" max="1" step="0.01"
        value={value}
        className="profile-slider__input"
        style={{ '--fill': pct }}
        onChange={e => onChange(parseFloat(e.target.value))}
        onMouseUp={e => onCommit(parseFloat(e.target.value))}
        onTouchEnd={e => onCommit(parseFloat(e.currentTarget.value))}
      />
    </div>
  );
}

// ── WeightsEditor ─────────────────────────────────────────────────────────────
// Renders as a profile-section (no card border — lives inside the merged card)

const WEIGHT_ITEMS = [
  { key: 'interest',   label: 'Interest match' },
  { key: 'recency',    label: 'Recency'         },
  { key: 'popularity', label: 'Popularity'      },
  { key: 'source',     label: 'Source quality'  },
];

function WeightsEditor({ initialWeights, onSave, flashKey, onFlashDone }) {
  const [weights, setWeights] = useState(initialWeights);
  const latest = useRef(initialWeights);

  useEffect(() => {
    setWeights(initialWeights);
    latest.current = initialWeights;
  }, [JSON.stringify(initialWeights)]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleChange(key, v) {
    const updated = { ...latest.current, [key]: v };
    latest.current = updated;
    setWeights(updated);
  }

  function handleCommit(key, v) {
    const updated = { ...latest.current, [key]: v };
    latest.current = updated;
    setWeights(updated);
    onSave(updated);
  }

  return (
    <div className="profile-section">
      <div className="profile-section__header">
        <div>
          <h2 className="profile-card__title">Feed Ranking</h2>
          <p className="profile-card__sub">Tune how your feed is ranked</p>
        </div>
        {flashKey > 0 && <SavedIndicator key={flashKey} onDone={onFlashDone} />}
      </div>
      {/* 2-column grid: 4 sliders → 2×2 */}
      <div className="profile-sliders profile-sliders--2col">
        {WEIGHT_ITEMS.map(({ key, label }) => (
          <Slider
            key={key}
            label={label}
            value={weights[key]}
            onChange={v => handleChange(key, v)}
            onCommit={v => handleCommit(key, v)}
          />
        ))}
      </div>
    </div>
  );
}

// ── SourcePrefsEditor ─────────────────────────────────────────────────────────

const PREF_ITEMS = [
  { key: 'news',       label: 'News'       },
  { key: 'video',      label: 'Video'      },
  { key: 'discussion', label: 'Discussion' },
];

function SourcePrefsEditor({ initialPrefs, onSave, flashKey, onFlashDone }) {
  const [prefs, setPrefs] = useState(initialPrefs);
  const latest = useRef(initialPrefs);

  useEffect(() => {
    setPrefs(initialPrefs);
    latest.current = initialPrefs;
  }, [JSON.stringify(initialPrefs)]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleChange(key, v) {
    const updated = { ...latest.current, [key]: v };
    latest.current = updated;
    setPrefs(updated);
  }

  function handleCommit(key, v) {
    const updated = { ...latest.current, [key]: v };
    latest.current = updated;
    setPrefs(updated);
    onSave(updated);
  }

  return (
    <div className="profile-section">
      <div className="profile-section__header">
        <div>
          <h2 className="profile-card__title">Source Preferences</h2>
          <p className="profile-card__sub">Adjust how much each source type influences your feed</p>
        </div>
        {flashKey > 0 && <SavedIndicator key={flashKey} onDone={onFlashDone} />}
      </div>
      {/* 3-column grid: one slider per source type */}
      <div className="profile-sliders profile-sliders--3col">
        {PREF_ITEMS.map(({ key, label }) => (
          <Slider
            key={key}
            label={label}
            value={prefs[key]}
            onChange={v => handleChange(key, v)}
            onCommit={v => handleCommit(key, v)}
          />
        ))}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Profile() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const [username,    setUsername]    = useState('');
  const [usernameErr, setUsernameErr] = useState('');
  const [savingUser,  setSavingUser]  = useState(false);
  const [userFlash,   setUserFlash]   = useState(0);

  const [initWeights, setInitWeights] = useState(DEFAULT_WEIGHTS);
  const [initPrefs,   setInitPrefs]   = useState(DEFAULT_SOURCE_PREFS);

  const [weightsFlash, setWeightsFlash] = useState(0);
  const [prefsFlash,   setPrefsFlash]   = useState(0);

  useEffect(() => {
    api.get('/api/users/me')
      .then(({ user: u }) => {
        setUser(u);
        setUsername(u.username);
        if (u.weights_json) {
          try { setInitWeights({ ...DEFAULT_WEIGHTS, ...JSON.parse(u.weights_json) }); }
          catch { /* keep defaults */ }
        }
        if (u.source_prefs_json) {
          try { setInitPrefs({ ...DEFAULT_SOURCE_PREFS, ...JSON.parse(u.source_prefs_json) }); }
          catch { /* keep defaults */ }
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSaveUsername() {
    const trimmed = username.trim();
    if (!trimmed || trimmed === user?.username) return;
    setSavingUser(true);
    setUsernameErr('');
    try {
      const { user: u } = await api.patch('/api/users/me', { username: trimmed });
      setUser(u);
      setUserFlash(n => n + 1);
    } catch (err) {
      setUsernameErr(
        err.status === 409 ? 'Username already taken' : (err.message ?? 'Failed to save')
      );
    } finally {
      setSavingUser(false);
    }
  }

  async function handleSaveWeights(updated) {
    try {
      await api.patch('/api/users/me', { weights_json: JSON.stringify(updated) });
      setWeightsFlash(n => n + 1);
    } catch { /* best-effort */ }
  }

  async function handleSavePrefs(updated) {
    try {
      await api.patch('/api/users/me', { source_prefs_json: JSON.stringify(updated) });
      setPrefsFlash(n => n + 1);
    } catch {}
  }

  if (loading) {
    return (
      <div className="profile-page">
        <div className="profile-skeleton profile-skeleton--tall" aria-hidden="true" />
        <div className="profile-skeleton profile-skeleton--short" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="profile-page">
      <h1 className="profile-page__heading">Profile</h1>

      {/* ── Single merged card: Account + Feed Ranking + Source Prefs ────── */}
      <div className="profile-card">

        {/* Account section */}
        <div className="profile-section">
          <div className="profile-section__header">
            <h2 className="profile-card__title">Account</h2>
            {userFlash > 0 && (
              <SavedIndicator key={userFlash} onDone={() => setUserFlash(0)} />
            )}
          </div>

          {/* Username form left, member-since meta right */}
          <div className="profile-account-grid">
            <div className="profile-form">
              <div className="profile-field">
                <label className="profile-field__label" htmlFor="profile-username">
                  Username
                </label>
                <input
                  id="profile-username"
                  type="text"
                  className={`profile-field__input${usernameErr ? ' profile-field__input--error' : ''}`}
                  value={username}
                  onChange={e => { setUsername(e.target.value); setUsernameErr(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleSaveUsername()}
                  autoComplete="username"
                />
                {usernameErr && (
                  <p className="profile-field__error" role="alert">{usernameErr}</p>
                )}
              </div>
              <div className="profile-form__actions">
                <button
                  className="btn btn--primary"
                  onClick={handleSaveUsername}
                  disabled={savingUser || !username.trim() || username.trim() === user?.username}
                >
                  {savingUser ? 'Saving…' : 'Save username'}
                </button>
              </div>
            </div>

            {user?.created_at && (
              <div className="profile-field profile-field--readonly">
                <span className="profile-field__label">Member since</span>
                <span className="profile-field__meta">{fmtDate(user.created_at)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Feed Ranking section */}
        <WeightsEditor
          initialWeights={initWeights}
          onSave={handleSaveWeights}
          flashKey={weightsFlash}
          onFlashDone={() => setWeightsFlash(0)}
        />

        {/* Source Preferences section */}
        <SourcePrefsEditor
          initialPrefs={initPrefs}
          onSave={handleSavePrefs}
          flashKey={prefsFlash}
          onFlashDone={() => setPrefsFlash(0)}
        />

      </div>

      {/* ── Appearance (separate card) ───────────────────────────────────── */}
      <div className="profile-card">
        <div className="profile-card__header">
          <div>
            <h2 className="profile-card__title">Appearance</h2>
            <p className="profile-card__sub">Switch between light and dark mode</p>
          </div>
        </div>
        <div className="profile-appearance">
          <span className="profile-appearance__label">Theme</span>
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}

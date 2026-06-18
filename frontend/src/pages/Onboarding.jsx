import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import api from '../api/client';
import '../styles/onboarding.css';

// Preset topics — name shown as chip label, keywords pre-filled for scoring
const PRESETS = [
  { name: 'Technology',   keywords: ['AI', 'software', 'tech', 'gadgets', 'cybersecurity'] },
  { name: 'Science',      keywords: ['research', 'discovery', 'physics', 'biology', 'chemistry'] },
  { name: 'Politics',     keywords: ['government', 'election', 'policy', 'legislation', 'democracy'] },
  { name: 'Business',     keywords: ['economy', 'market', 'finance', 'stocks', 'startup'] },
  { name: 'Sports',       keywords: ['football', 'soccer', 'basketball', 'athletics', 'tennis'] },
  { name: 'Health',       keywords: ['medicine', 'health', 'wellness', 'medical', 'nutrition'] },
  { name: 'Environment',  keywords: ['climate', 'sustainability', 'renewable energy', 'ecology'] },
  { name: 'Entertainment',keywords: ['movies', 'music', 'celebrity', 'film', 'streaming'] },
  { name: 'Space',        keywords: ['NASA', 'astronomy', 'space exploration', 'rocket', 'planet'] },
  { name: 'World News',   keywords: ['international', 'geopolitics', 'conflict', 'diplomacy'] },
];

export default function Onboarding() {
  const navigate = useNavigate();

  // Set of selected preset names
  const [selected, setSelected] = useState(new Set());
  // Additional custom interests typed by the user
  const [custom, setCustom] = useState([]);
  const [customInput, setCustomInput] = useState('');
  const [saving, setSaving] = useState(false);

  function togglePreset(name) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  }

  function commitCustomInput() {
    const val = customInput.trim();
    if (val && !custom.includes(val) && !PRESETS.some(p => p.name === val)) {
      setCustom(prev => [...prev, val]);
    }
    setCustomInput('');
  }

  function removeCustom(name) {
    setCustom(prev => prev.filter(n => n !== name));
  }

  async function handleGetStarted() {
    const toCreate = [
      ...PRESETS.filter(p => selected.has(p.name)),
      ...custom.map(name => ({ name, keywords: [] })),
    ];

    setSaving(true);
    try {
      if (toCreate.length > 0) {
        await Promise.all(
          toCreate.map(({ name, keywords }) =>
            api.post('/api/interests', { name, keywords, weight: 1.0 })
          )
        );
      }
    } catch { /* best-effort — don't block navigation on partial failure */ }

    navigate('/feed', { replace: true });
  }

  return (
    <div className="onboarding">
      <div className="onboarding__card">

        <div className="onboarding__header">
          <h1 className="onboarding__title">What are you interested in?</h1>
          <p className="onboarding__sub">
            Pick a few topics to personalise your feed. You can always change these later.
          </p>
        </div>

        {/* Preset chips */}
        <div className="onboarding__chips">
          {PRESETS.map(({ name }) => (
            <button
              key={name}
              type="button"
              className={`onboarding__chip${selected.has(name) ? ' onboarding__chip--active' : ''}`}
              onClick={() => togglePreset(name)}
            >
              {name}
            </button>
          ))}
        </div>

        {/* Custom interests */}
        <div className="onboarding__custom">
          <p className="onboarding__custom-label">Add your own</p>
          <div className="onboarding__custom-row">
            <input
              type="text"
              className="onboarding__custom-input"
              placeholder="e.g. Machine Learning"
              value={customInput}
              onChange={e => setCustomInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitCustomInput(); } }}
            />
            <button
              type="button"
              className="onboarding__custom-add"
              onClick={commitCustomInput}
              disabled={!customInput.trim()}
            >
              Add
            </button>
          </div>

          {custom.length > 0 && (
            <div className="onboarding__custom-chips">
              {custom.map(name => (
                <span key={name} className="onboarding__chip onboarding__chip--active onboarding__chip--custom">
                  {name}
                  <button
                    type="button"
                    className="onboarding__chip-remove"
                    onClick={() => removeCustom(name)}
                    aria-label={`Remove ${name}`}
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="onboarding__actions">
          <button
            className="onboarding__btn-primary"
            onClick={handleGetStarted}
            disabled={saving}
          >
            {saving ? 'Setting up…' : 'Get started'}
          </button>
          <button
            className="onboarding__btn-ghost"
            onClick={() => navigate('/feed', { replace: true })}
            disabled={saving}
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}

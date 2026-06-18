import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

const WEIGHT_MAX = 2.0;
const WEIGHT_MIN = 0.0;
const WEIGHT_STEP = 0.1;

export default function InterestFormModal({ initial, onSave, onClose }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [keywords, setKeywords] = useState(initial?.keywords ?? []);
  const [weight, setWeight] = useState(initial?.weight ?? 1.0);
  const [kwInput, setKwInput] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const nameRef = useRef(null);

  const isEdit = Boolean(initial);

  // Focus name field on open
  useEffect(() => { nameRef.current?.focus(); }, []);

  // Close on Escape
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  function commitKwInput() {
    const val = kwInput.trim().replace(/,$/, '').trim();
    if (val && !keywords.includes(val)) {
      setKeywords(prev => [...prev, val]);
    }
    setKwInput('');
  }

  function handleKwKeyDown(e) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commitKwInput();
    } else if (e.key === 'Backspace' && kwInput === '' && keywords.length > 0) {
      setKeywords(prev => prev.slice(0, -1));
    }
  }

  function removeKeyword(kw) {
    setKeywords(prev => prev.filter(k => k !== kw));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');
    if (!name.trim()) { setFormError("Name is required."); return; }
    // commit any in-progress keyword input before submitting
    const finalKeywords = [...keywords];
    const pendingKw = kwInput.trim().replace(/,$/, '').trim();
    if (pendingKw && !finalKeywords.includes(pendingKw)) {
      finalKeywords.push(pendingKw);
    }
    setSubmitting(true);
    try {
      await onSave({ name: name.trim(), keywords: finalKeywords, weight: parseFloat(weight) });
    } catch (err) {
      setFormError(err.message ?? 'Something went wrong. Please try again.');
      setSubmitting(false);
    }
  }

  const weightPct = ((weight - WEIGHT_MIN) / (WEIGHT_MAX - WEIGHT_MIN)) * 100;

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true"
         aria-label={isEdit ? 'Edit interest' : 'Create interest'}>
      <div className="library-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="library-modal__header">
          <h2 className="library-modal__title">{isEdit ? 'Edit interest' : 'New interest'}</h2>
          <button className="library-modal__close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form className="library-modal__body" onSubmit={handleSubmit} noValidate>
          {/* Name */}
          <label className="form-label">
            Name <span aria-hidden="true" className="form-required">*</span>
            <input
              ref={nameRef}
              type="text"
              className="form-input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Machine Learning"
              maxLength={120}
            />
          </label>

          {/* Keywords */}
          <label className="form-label">
            Keywords
            <span className="form-hint">Press Enter or comma to add</span>
            <div className="chip-input" onClick={() => nameRef.current && document.getElementById('kw-input')?.focus()}>
              {keywords.map(kw => (
                <span key={kw} className="chip chip--removable">
                  {kw}
                  <button
                    type="button"
                    className="chip__remove"
                    onClick={() => removeKeyword(kw)}
                    aria-label={`Remove ${kw}`}
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
              <input
                id="kw-input"
                type="text"
                className="chip-input__field"
                value={kwInput}
                onChange={e => setKwInput(e.target.value)}
                onKeyDown={handleKwKeyDown}
                onBlur={commitKwInput}
                placeholder={keywords.length === 0 ? 'e.g. neural networks' : ''}
              />
            </div>
          </label>

          {/* Weight slider */}
          <label className="form-label">
            <span className="form-label__row">
              Weight
              <span className="weight-readout">{Number(weight).toFixed(1)}</span>
            </span>
            <div className="weight-slider-wrap">
              <span className="weight-slider-min">0</span>
              <input
                type="range"
                className="weight-slider"
                min={WEIGHT_MIN}
                max={WEIGHT_MAX}
                step={WEIGHT_STEP}
                value={weight}
                onChange={e => setWeight(e.target.value)}
                style={{ '--pct': `${weightPct}%` }}
              />
              <span className="weight-slider-max">2</span>
            </div>
          </label>

          {/* Inline error */}
          {formError && (
            <p className="form-error" role="alert">{formError}</p>
          )}

          {/* Actions */}
          <div className="library-modal__actions">
            <button type="button" className="btn btn--ghost" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary" disabled={submitting}>
              {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

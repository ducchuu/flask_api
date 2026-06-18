import { useEffect, useState } from 'react';
import { X, Plus, Check, FolderOpen } from 'lucide-react';
import api from '../api/client';

// Inline mini-form for creating a collection without leaving the picker
function InlineCollectionForm({ onCreate, onCancel }) {
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required.'); return; }
    setSubmitting(true);
    try {
      const col = await api.post('/api/collections', { name: name.trim() });
      onCreate(col);
    } catch (err) {
      setError(err.message ?? 'Failed to create.');
      setSubmitting(false);
    }
  }

  return (
    <form className="picker-inline-form" onSubmit={handleSubmit} noValidate>
      <input
        autoFocus
        type="text"
        className="form-input"
        placeholder="Collection name"
        value={name}
        onChange={e => setName(e.target.value)}
        maxLength={120}
      />
      {error && <p className="form-error" role="alert" style={{ margin: '0.25rem 0 0' }}>{error}</p>}
      <div className="picker-inline-form__actions">
        <button type="button" className="btn btn--ghost btn--sm" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
        <button type="submit" className="btn btn--primary btn--sm" disabled={submitting}>
          {submitting ? 'Creating…' : 'Create & save'}
        </button>
      </div>
    </form>
  );
}

// CollectionPicker — opens as a modal, lists collections, lets user pick one
// or create a new one inline. Calls PUT /api/collections/:id/items/:itemDbId.
export default function CollectionPicker({ itemDbId, onClose }) {
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [savedId, setSavedId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/api/collections')
      .then(setCollections)
      .catch(() => setError('Could not load collections.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handlePick(col) {
    if (savedId === col.id) { onClose(); return; }
    setSavingId(col.id);
    setError('');
    try {
      await api.put(`/api/collections/${col.id}/items/${itemDbId}`);
      setSavedId(col.id);
      setSavingId(null);
    } catch (err) {
      setError(err.message ?? 'Failed to save.');
      setSavingId(null);
    }
  }

  function handleCreated(newCol) {
    setCollections(prev => [newCol, ...prev]);
    setShowCreate(false);
    handlePick(newCol);
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true"
         aria-label="Save to collection">
      <div className="collection-picker" onClick={e => e.stopPropagation()}>
        <div className="collection-picker__header">
          <h2 className="collection-picker__title">Save to collection</h2>
          <button className="library-modal__close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {error && <p className="form-error" role="alert" style={{ margin: '0 1.25rem 0.5rem' }}>{error}</p>}

        <div className="collection-picker__body">
          {loading ? (
            <p className="picker-hint">Loading…</p>
          ) : collections.length === 0 && !showCreate ? (
            <p className="picker-hint">You have no collections yet.</p>
          ) : (
            <ul className="picker-list">
              {collections.map(col => (
                <li key={col.id}>
                  <button
                    className={`picker-item${savedId === col.id ? ' picker-item--saved' : ''}`}
                    onClick={() => handlePick(col)}
                    disabled={savingId === col.id}
                  >
                    <FolderOpen size={16} strokeWidth={1.75} aria-hidden="true" />
                    <span className="picker-item__name">{col.name}</span>
                    {savedId === col.id && (
                      <Check size={16} className="picker-item__check" aria-label="Saved" />
                    )}
                    {savingId === col.id && (
                      <span className="picker-item__saving">Saving…</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {showCreate ? (
            <InlineCollectionForm
              onCreate={handleCreated}
              onCancel={() => setShowCreate(false)}
            />
          ) : (
            <button className="picker-create-btn" onClick={() => setShowCreate(true)}>
              <Plus size={15} strokeWidth={2} aria-hidden="true" />
              New collection
            </button>
          )}
        </div>

        {savedId && (
          <div className="collection-picker__footer">
            <button className="btn btn--primary" style={{ width: '100%' }} onClick={onClose}>
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

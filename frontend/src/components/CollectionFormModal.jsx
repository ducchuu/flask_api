import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

export default function CollectionFormModal({ initial, onSave, onClose }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [desc, setDesc] = useState(initial?.description ?? '');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const nameRef = useRef(null);
  const isEdit = Boolean(initial);

  useEffect(() => { nameRef.current?.focus(); }, []);
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');
    if (!name.trim()) { setFormError('Name is required.'); return; }
    setSubmitting(true);
    try {
      await onSave({ name: name.trim(), description: desc.trim() || null });
    } catch (err) {
      setFormError(err.message ?? 'Something went wrong.');
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="library-modal" onClick={e => e.stopPropagation()}>
        <div className="library-modal__header">
          <h2 className="library-modal__title">
            {isEdit ? 'Edit collection' : 'New collection'}
          </h2>
          <button className="library-modal__close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form className="library-modal__body" onSubmit={handleSubmit} noValidate>
          <label className="form-label">
            Name <span aria-hidden="true" className="form-required">*</span>
            <input
              ref={nameRef}
              type="text"
              className="form-input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Must-reads"
              maxLength={120}
            />
          </label>

          <label className="form-label">
            Description
            <span className="form-hint">Optional</span>
            <textarea
              className="form-input form-textarea"
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder="What are you collecting here?"
              rows={3}
              maxLength={500}
            />
          </label>

          {formError && <p className="form-error" role="alert">{formError}</p>}

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

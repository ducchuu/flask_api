import { useCallback, useEffect, useRef, useState } from 'react';
import { Pencil, Trash2, Plus, Tags, FolderOpen, FolderPlus, ArrowLeft, ExternalLink } from 'lucide-react';
import { useInterests } from '../context/InterestsContext';
import InterestFormModal from '../components/InterestFormModal';
import CollectionFormModal from '../components/CollectionFormModal';
import ConfirmDialog from '../components/ConfirmDialog';
import api from '../api/client';
import '../styles/feed.css';
import '../styles/library.css';

const WEIGHT_MAX = 2.0;
const SOURCE_LABELS = { news: 'News', video: 'Video', discussion: 'Discussion' };

// ── Toast ─────────────────────────────────────────────────────────────────────

let _toastId = 0;
function useToasts() {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const addToast = useCallback((message, type = 'success') => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, message, type }]);
    timers.current[id] = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
      delete timers.current[id];
    }, 3000);
  }, []);

  useEffect(() => {
    const captured = timers.current;
    return () => Object.values(captured).forEach(clearTimeout);
  }, []);

  return [toasts, addToast];
}

// ── InterestRow ───────────────────────────────────────────────────────────────

function InterestRow({ interest, onEdit, onDelete }) {
  const { name, keywords, weight } = interest;
  const barPct = Math.min(100, Math.round((weight / WEIGHT_MAX) * 100));

  return (
    <div className="interest-row">
      <div className="interest-row__top">
        <span className="interest-row__name">{name}</span>
        <div className="interest-row__actions">
          <button className="icon-btn" onClick={() => onEdit(interest)}
            aria-label={`Edit ${name}`} title="Edit">
            <Pencil size={15} strokeWidth={1.75} />
          </button>
          <button className="icon-btn icon-btn--danger" onClick={() => onDelete(interest)}
            aria-label={`Delete ${name}`} title="Delete">
            <Trash2 size={15} strokeWidth={1.75} />
          </button>
        </div>
      </div>
      {keywords.length > 0 && (
        <div className="interest-row__chips">
          {keywords.map(kw => <span key={kw} className="chip">{kw}</span>)}
        </div>
      )}
      <div className="interest-row__weight">
        <span className="interest-row__weight-label">Weight</span>
        <div className="weight-bar" role="progressbar"
          aria-valuenow={weight} aria-valuemin={0} aria-valuemax={WEIGHT_MAX}>
          <div className="weight-bar__fill" style={{ width: `${barPct}%` }} />
        </div>
        <span className="interest-row__weight-val">{weight.toFixed(1)}</span>
      </div>
    </div>
  );
}

// ── CollectionCard ────────────────────────────────────────────────────────────

function CollectionCard({ collection, onOpen, onEdit, onDelete }) {
  const { name, description } = collection;
  return (
    <div className="collection-card">
      <button className="collection-card__body" onClick={() => onOpen(collection)}>
        <FolderOpen size={20} strokeWidth={1.5} className="collection-card__icon" aria-hidden="true" />
        <span className="collection-card__name">{name}</span>
        {description && <p className="collection-card__desc">{description}</p>}
      </button>
      <div className="collection-card__actions">
        <button className="icon-btn" onClick={() => onEdit(collection)}
          aria-label={`Edit ${name}`} title="Edit">
          <Pencil size={14} strokeWidth={1.75} />
        </button>
        <button className="icon-btn icon-btn--danger" onClick={() => onDelete(collection)}
          aria-label={`Delete ${name}`} title="Delete">
          <Trash2 size={14} strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}

// ── CollectionDetail (items inside a collection) ──────────────────────────────

function CollectionDetail({ collection, onBack, onItemRemoved, addToast }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState(null);

  useEffect(() => {
    setLoading(true);
    api.get(`/api/collections/${collection.id}`)
      .then(setDetail)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [collection.id]);

  async function handleRemove(item) {
    setRemovingId(item.id);
    try {
      await api.del(`/api/collections/${collection.id}/items/${item.id}`);
      setDetail(prev => ({ ...prev, items: prev.items.filter(i => i.id !== item.id) }));
      addToast(`"${item.title}" removed from collection`, 'info');
      onItemRemoved();
    } catch (err) {
      addToast(err.message ?? 'Failed to remove item.', 'error');
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div>
      <div className="collection-detail__header">
        <button className="item-detail__back" onClick={onBack}
          style={{ marginBottom: 0 }}>
          <ArrowLeft size={16} aria-hidden="true" />
          All collections
        </button>
        <h2 className="library-section-title">{collection.name}</h2>
        {collection.description && (
          <p className="library-section-sub">{collection.description}</p>
        )}
      </div>

      {loading ? (
        <div className="interest-list">
          {[1,2,3].map(i => <div key={i} className="collection-item-skeleton" />)}
        </div>
      ) : !detail || detail.items.length === 0 ? (
        <div className="library-empty">
          <FolderOpen size={36} strokeWidth={1.25} className="library-empty__icon" />
          <h3 className="library-empty__heading">This collection is empty</h3>
          <p className="library-empty__body">
            Go to an item's detail page and click "Save to collection" to add it here.
          </p>
        </div>
      ) : (
        <ul className="collection-items-list">
          {detail.items.map(item => (
            <li key={item.id} className="collection-item-row">
              <div className="collection-item-row__meta">
                <span className={`item-card__tag item-card__tag--${item.source_type}`}>
                  {SOURCE_LABELS[item.source_type] ?? item.source_type}
                </span>
              </div>
              <span className="collection-item-row__title">{item.title}</span>
              <div className="collection-item-row__actions">
                {item.url && (
                  <a href={item.url} target="_blank" rel="noopener noreferrer"
                    className="icon-btn" title="Open original" aria-label="Open original">
                    <ExternalLink size={14} strokeWidth={1.75} />
                  </a>
                )}
                <button
                  className="icon-btn icon-btn--danger"
                  onClick={() => handleRemove(item)}
                  disabled={removingId === item.id}
                  title="Remove from collection"
                  aria-label={`Remove ${item.title} from collection`}
                >
                  <Trash2 size={14} strokeWidth={1.75} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Collections tab ───────────────────────────────────────────────────────────

function CollectionsTab({ addToast }) {
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | { mode: 'create' } | { mode: 'edit', col }
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [activeCol, setActiveCol] = useState(null); // collection selected for detail view

  function loadCollections() {
    return api.get('/api/collections').then(setCollections).catch(() => {});
  }

  useEffect(() => {
    loadCollections().finally(() => setLoading(false));
  }, []);

  async function handleSave(data) {
    if (modal?.mode === 'edit') {
      const updated = await api.put(`/api/collections/${modal.col.id}`, data);
      setCollections(prev => prev.map(c => c.id === updated.id ? updated : c));
      // Update activeCol if we're editing the open one
      if (activeCol?.id === updated.id) setActiveCol(updated);
      addToast(`"${data.name}" updated`);
    } else {
      const created = await api.post('/api/collections', data);
      setCollections(prev => [created, ...prev]);
      addToast(`"${data.name}" created`);
    }
    setModal(null);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await api.del(`/api/collections/${deleteTarget.id}`);
    setCollections(prev => prev.filter(c => c.id !== deleteTarget.id));
    if (activeCol?.id === deleteTarget.id) setActiveCol(null);
    addToast(`"${deleteTarget.name}" deleted`, 'info');
    setDeleteTarget(null);
  }

  if (loading) {
    return <div className="interest-list">
      {[1,2,3].map(i => <div key={i} className="collection-card collection-card--skeleton" />)}
    </div>;
  }

  if (activeCol) {
    return (
      <>
        <CollectionDetail
          collection={activeCol}
          onBack={() => setActiveCol(null)}
          onItemRemoved={() => {}}
          addToast={addToast}
        />
        {modal && (
          <CollectionFormModal
            initial={modal.col ?? null}
            onSave={handleSave}
            onClose={() => setModal(null)}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div className="library-section-header">
        <div>
          <h2 className="library-section-title">Your collections</h2>
          <p className="library-section-sub">
            Curated buckets for items you want to revisit.
          </p>
        </div>
        <button className="btn btn--primary" onClick={() => setModal({ mode: 'create' })}>
          <Plus size={15} strokeWidth={2} aria-hidden="true" />
          New collection
        </button>
      </div>

      {collections.length === 0 ? (
        <div className="library-empty">
          <FolderPlus size={40} strokeWidth={1.25} className="library-empty__icon" />
          <h3 className="library-empty__heading">No collections yet</h3>
          <p className="library-empty__body">
            Create a collection to save items from your feed for later.
          </p>
          <button className="btn btn--primary" onClick={() => setModal({ mode: 'create' })}>
            <Plus size={15} strokeWidth={2} aria-hidden="true" />
            Create your first collection
          </button>
        </div>
      ) : (
        <div className="collection-grid">
          {collections.map(col => (
            <CollectionCard
              key={col.id}
              collection={col}
              onOpen={setActiveCol}
              onEdit={c => setModal({ mode: 'edit', col: c })}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      )}

      {modal && (
        <CollectionFormModal
          initial={modal.mode === 'edit' ? modal.col : null}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          message={`Delete collection "${deleteTarget.name}"? Items inside won't be deleted, just removed from this collection.`}
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Library() {
  const [interests, refreshInterests] = useInterests();
  const [activeTab, setActiveTab] = useState('interests');
  const [modal, setModal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [toasts, addToast] = useToasts();

  async function handleInterestSave(data) {
    if (modal?.mode === 'edit') {
      await api.put(`/api/interests/${modal.interest.id}`, data);
      addToast(`"${data.name}" updated`);
    } else {
      await api.post('/api/interests', data);
      addToast(`"${data.name}" created`);
    }
    refreshInterests();
    setModal(null);
  }

  async function handleInterestDelete() {
    if (!deleteTarget) return;
    await api.del(`/api/interests/${deleteTarget.id}`);
    addToast(`"${deleteTarget.name}" deleted`, 'info');
    refreshInterests();
    setDeleteTarget(null);
  }

  return (
    <div className="library-page">
      <div className="library-tabs">
        <button
          className={`library-tab${activeTab === 'interests' ? ' library-tab--active' : ''}`}
          onClick={() => setActiveTab('interests')}
        >
          Interests
        </button>
        <button
          className={`library-tab${activeTab === 'collections' ? ' library-tab--active' : ''}`}
          onClick={() => setActiveTab('collections')}
        >
          Collections
        </button>
      </div>

      <div className="library-content">
        {activeTab === 'interests' ? (
          <>
            <div className="library-section-header">
              <div>
                <h2 className="library-section-title">Your interests</h2>
                <p className="library-section-sub">
                  Topics that shape your feed — higher weight = stronger signal.
                </p>
              </div>
              <button className="btn btn--primary" onClick={() => setModal({ mode: 'create' })}>
                <Plus size={15} strokeWidth={2} aria-hidden="true" />
                New interest
              </button>
            </div>

            {interests.length === 0 ? (
              <div className="library-empty">
                <Tags size={40} strokeWidth={1.25} className="library-empty__icon" />
                <h3 className="library-empty__heading">No interests yet</h3>
                <p className="library-empty__body">
                  Add topics you care about and Pulse will surface relevant items in your feed.
                </p>
                <button className="btn btn--primary" onClick={() => setModal({ mode: 'create' })}>
                  <Plus size={15} strokeWidth={2} aria-hidden="true" />
                  Add your first interest
                </button>
              </div>
            ) : (
              <div className="interest-list">
                {interests.map(interest => (
                  <InterestRow
                    key={interest.id}
                    interest={interest}
                    onEdit={i => setModal({ mode: 'edit', interest: i })}
                    onDelete={setDeleteTarget}
                  />
                ))}
              </div>
            )}

            {modal && (
              <InterestFormModal
                initial={modal.mode === 'edit' ? modal.interest : null}
                onSave={handleInterestSave}
                onClose={() => setModal(null)}
              />
            )}
            {deleteTarget && (
              <ConfirmDialog
                message={`Delete interest "${deleteTarget.name}"? This cannot be undone.`}
                confirmLabel="Delete"
                onConfirm={handleInterestDelete}
                onCancel={() => setDeleteTarget(null)}
              />
            )}
          </>
        ) : (
          <CollectionsTab addToast={addToast} />
        )}
      </div>

      <div className="toast-stack" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast--${t.type}`}>{t.message}</div>
        ))}
      </div>
    </div>
  );
}

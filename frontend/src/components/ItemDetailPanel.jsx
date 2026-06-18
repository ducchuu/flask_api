import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ExternalLink, Bookmark,
  Clock, Eye, ThumbsUp, MessageCircle, Layers,
} from 'lucide-react';
import CollectionPicker from './CollectionPicker';
import api from '../api/client';
import '../styles/feed.css';
import '../styles/item_detail.css';
import '../styles/library.css'; // .btn, .btn--primary, .btn--ghost

const SOURCE_LABELS = { news: 'News', video: 'Video', discussion: 'Discussion' };

function relativeTime(iso) {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${Math.max(0, m)}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function MetricBadge({ icon: Icon, value, label }) {
  if (!value && value !== 0) return null;
  const display = value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value;
  return (
    <span className="item-detail__metric" title={label}>
      <Icon size={14} strokeWidth={1.75} aria-hidden="true" />
      {display}
    </span>
  );
}

export default function ItemDetailPanel({ externalId }) {
  const navigate = useNavigate();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [storyItems, setStoryItems] = useState([]);

  useEffect(() => {
    if (!externalId) return;
    setItem(null);
    setStoryItems([]);
    setLoading(true);
    setError('');

    api.get(`/api/items/${externalId}`)
      .then(data => {
        setItem(data);
        setLoading(false);
        if (data.story_id) {
          api.get(`/api/stories/${data.story_id}`)
            .then(story => {
              const others = (story.items ?? []).filter(
                i => i.external_id && i.external_id !== externalId
              );
              setStoryItems(others);
            })
            .catch(() => {});
        }
      })
      .catch(err => {
        setError(err.message ?? 'Item not found.');
        setLoading(false);
      });
  }, [externalId]);

  function handleBack() { navigate('/feed'); }

  if (loading) {
    return (
      <div className="item-panel">
        <button className="item-panel__back" onClick={handleBack}>
          <ArrowLeft size={16} aria-hidden="true" /> Back to feed
        </button>
        <div className="item-detail__skeleton">
          <div className="skeleton-line skeleton-line--wide" />
          <div className="skeleton-line skeleton-line--long" />
          <div className="skeleton-line skeleton-line--medium" />
          <div className="skeleton-line skeleton-line--short" />
        </div>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="item-panel">
        <button className="item-panel__back" onClick={handleBack}>
          <ArrowLeft size={16} aria-hidden="true" /> Back to feed
        </button>
        <p className="item-detail__error">{error || 'Item not found.'}</p>
      </div>
    );
  }

  const {
    id: dbId, title, summary, source_type, source_name,
    author, published_at, keywords, metrics, credibility, url, read_time,
  } = item;

  return (
    <div className="item-panel">
      <button className="item-panel__back" onClick={handleBack}>
        <ArrowLeft size={16} aria-hidden="true" />
        Back to feed
      </button>

      <article className="item-detail__card">
        {/* Meta row */}
        <div className="item-detail__meta">
          <span className={`item-card__tag item-card__tag--${source_type}`}>
            {SOURCE_LABELS[source_type] ?? source_type}
          </span>
          {credibility && credibility !== 'unknown' && (
            <span className={`item-card__cred item-card__cred--${credibility}`}>
              {credibility}
            </span>
          )}
          {source_name && <span className="item-detail__source">{source_name}</span>}
          <time className="item-detail__time" dateTime={published_at}>
            {relativeTime(published_at)}
          </time>
        </div>

        <h1 className="item-detail__title">{title}</h1>

        <div className="item-detail__byline">
          {author && <span className="item-detail__author">by {author}</span>}
          {read_time > 0 && (
            <span className="item-detail__readtime">
              <Clock size={13} aria-hidden="true" /> {read_time} min read
            </span>
          )}
          <MetricBadge icon={Eye}           value={metrics?.views}    label="Views" />
          <MetricBadge icon={ThumbsUp}      value={metrics?.likes}    label="Likes" />
          <MetricBadge icon={MessageCircle} value={metrics?.comments} label="Comments" />
        </div>

        {summary && <p className="item-detail__summary">{summary}</p>}

        {keywords?.length > 0 && (
          <div className="item-detail__keywords">
            {keywords.map(kw => <span key={kw} className="chip">{kw}</span>)}
          </div>
        )}

        <div className="item-detail__actions">
          {url && (
            <a href={url} target="_blank" rel="noopener noreferrer" className="btn btn--ghost">
              <ExternalLink size={15} aria-hidden="true" />
              Open original
            </a>
          )}
          <button className="btn btn--primary" onClick={() => setPickerOpen(true)}>
            <Bookmark size={15} aria-hidden="true" />
            Save to collection
          </button>
        </div>
      </article>

      {/* Story cluster — other items in the same story */}
      {storyItems.length > 0 && (
        <section className="item-panel__cluster">
          <h2 className="item-panel__cluster-title">
            <Layers size={14} aria-hidden="true" />
            Also in this story
          </h2>
          <ul className="item-panel__cluster-list">
            {storyItems.map(si => (
              <li key={si.id}>
                <button
                  className="cluster-item"
                  onClick={() => navigate(`/items/${si.external_id}`)}
                >
                  <span className={`item-card__tag item-card__tag--${si.source_type}`}>
                    {SOURCE_LABELS[si.source_type] ?? si.source_type}
                  </span>
                  <span className="cluster-item__title">{si.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {pickerOpen && (
        <CollectionPicker itemDbId={dbId} onClose={() => setPickerOpen(false)} />
      )}
    </div>
  );
}

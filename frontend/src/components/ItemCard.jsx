import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Newspaper } from 'lucide-react';

const SOURCE_LABELS = { news: 'News', video: 'Video', discussion: 'Discussion' };

function relativeTime(iso) {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${Math.max(0, m)}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// ── Provider icons ────────────────────────────────────────────────────────────

// Minimal YouTube logo: red rounded rect + white play triangle
function YouTubeIcon() {
  return (
    <svg
      width="15" height="11"
      viewBox="0 0 15 11"
      fill="none"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <rect width="15" height="11" rx="2.5" fill="#FF0000" />
      <path d="M6 2.5L11 5.5L6 8.5Z" fill="white" />
    </svg>
  );
}

// News: fetches the site's favicon via Google's reliable favicon service.
// Falls back to a Newspaper icon on any load error (never shows broken-image icon).
function NewsFavicon({ url }) {
  const [failed, setFailed] = useState(false);

  if (failed || !url) {
    return <Newspaper size={13} strokeWidth={1.75} aria-hidden="true" style={{ flexShrink: 0 }} />;
  }

  let domain;
  try {
    domain = new URL(url).hostname;
  } catch {
    return <Newspaper size={13} strokeWidth={1.75} aria-hidden="true" style={{ flexShrink: 0 }} />;
  }

  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
      alt=""
      width={13}
      height={13}
      style={{ flexShrink: 0, borderRadius: 2 }}
      onError={() => setFailed(true)}
    />
  );
}

// ── Source display helpers ────────────────────────────────────────────────────

// Discussion source_name is always "Lemmy/c/<community>".
// Strip the "Lemmy/" prefix to show just "c/technology" etc.
function cleanDiscussionName(name) {
  if (!name) return name;
  return name.replace(/^Lemmy\//, '');
}

// Renders icon + label for the source provider cell in the meta row.
function SourceProvider({ source_type, source_name, url }) {
  if (source_type === 'video') {
    return (
      <span className="item-card__source">
        <YouTubeIcon />
        {source_name}
      </span>
    );
  }

  if (source_type === 'news') {
    return (
      <span className="item-card__source">
        <NewsFavicon url={url} />
        {source_name}
      </span>
    );
  }

  // discussion — clean the Lemmy community name, no icon
  const label = cleanDiscussionName(source_name);
  return label ? <span className="item-card__source">{label}</span> : null;
}

// ── Card ──────────────────────────────────────────────────────────────────────

export default function ItemCard({ item }) {
  const nav = useNavigate();
  const { id, source_type, source_name, url, title, summary, credibility, published_at } = item;

  return (
    <article
      className="item-card"
      onClick={() => nav(`/items/${id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && nav(`/items/${id}`)}
    >
      <div className="item-card__meta">
        <span className={`item-card__tag item-card__tag--${source_type}`}>
          {SOURCE_LABELS[source_type] ?? source_type}
        </span>
        {credibility && credibility !== 'unknown' && (
          <span className={`item-card__cred item-card__cred--${credibility}`}>
            {credibility}
          </span>
        )}
        {source_name && (
          <SourceProvider
            source_type={source_type}
            source_name={source_name}
            url={url}
          />
        )}
      </div>

      <h3 className="item-card__title">{title}</h3>

      {summary && <p className="item-card__summary">{summary}</p>}

      <div className="item-card__footer">
        <time className="item-card__time" dateTime={published_at}>
          {relativeTime(published_at)}
        </time>
      </div>
    </article>
  );
}

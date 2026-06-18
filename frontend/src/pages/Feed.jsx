import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useInterests } from '../context/InterestsContext';
import FilterBar from '../components/FilterBar';
import SearchInput from '../components/SearchInput';
import ItemCard from '../components/ItemCard';
import ItemDetailPanel from '../components/ItemDetailPanel';
import LoadingSkeleton from '../components/LoadingSkeleton';
import EmptyState from '../components/EmptyState';
import ErrorBanner from '../components/ErrorBanner';
import api from '../api/client';
import '../styles/feed.css';

const PER_PAGE = 20;

// Backend uses `source`, `query`, `days` — not the names in PAGES.md
const WINDOW_TO_DAYS = { '24h': 1, '7d': 7, '30d': 30 };

function buildApiParams(filters, page) {
  const p = { per_page: PER_PAGE, page };
  if (filters.source_type) p.source = filters.source_type;
  if (filters.q)           p.query  = filters.q;
  if (filters.window)      p.days   = WINDOW_TO_DAYS[filters.window];
  if (filters.sort)        p.sort   = filters.sort;
  return p;
}

function flattenStories(data) {
  if (!Array.isArray(data)) return [];
  return data.flatMap(story =>
    (story.items ?? []).map(item => ({ ...item, story_id: story.id }))
  );
}

// The backend has no interest_id param — filter client-side against item keywords/text
function applyInterestFilter(items, interests, interestId) {
  if (!interestId) return items;
  const interest = interests.find(i => String(i.id) === interestId);
  if (!interest) return items;
  const keywords = interest.keywords.map(k => k.toLowerCase());
  return items.filter(item => {
    const text = ((item.title ?? '') + ' ' + (item.summary ?? '')).toLowerCase();
    return keywords.some(k =>
      text.includes(k) || (item.keywords ?? []).some(ik => ik.toLowerCase() === k)
    );
  });
}

export default function Feed() {
  // When URL is /items/:id this param is set; /feed → undefined
  const { id: activeItemId } = useParams();
  const isPanelOpen = Boolean(activeItemId);

  const [filters, setFilters] = useState({
    source_type: '', interest_id: '', window: '', sort: 'relevance', q: '',
  });
  const [allItems, setAllItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [banner, setBanner] = useState(null);

  const sentinelRef = useRef(null);
  // Ref holds the latest load-more closure so the IntersectionObserver never goes stale
  const loadMoreFn = useRef(null);

  // Interests come from shared context so Library changes propagate here instantly
  const [interests] = useInterests();

  // Re-fetch from page 1 whenever an API-driven filter changes.
  // interest_id is excluded because it's applied client-side after the fetch.
  const filterKey = [filters.source_type, filters.window, filters.sort, filters.q].join('|');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setAllItems([]);
    setPage(1);
    setHasMore(true);

    api.get('/api/items', buildApiParams(filters, 1))
      .then(data => {
        if (cancelled) return;
        const flat = flattenStories(data);
        setAllItems(flat);
        setHasMore(flat.length >= PER_PAGE);
        setLoading(false);
      })
      .catch(err => {
        if (cancelled) return;
        if (err.status === 429 || err.status === 502) {
          setBanner('Some sources are temporarily unavailable — showing what we have');
        }
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [filterKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the ref in sync with current state so the IntersectionObserver callback
  // always calls the latest version without triggering observer re-setup
  loadMoreFn.current = async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    try {
      const data = await api.get('/api/items', buildApiParams(filters, nextPage));
      const flat = flattenStories(data);
      setAllItems(prev => [...prev, ...flat]);
      setHasMore(flat.length >= PER_PAGE);
      setPage(nextPage);
    } catch (err) {
      if (err.status === 429 || err.status === 502) {
        setBanner('Some sources are temporarily unavailable — showing what we have');
      }
    } finally {
      setLoadingMore(false);
    }
  };

  // Set up IntersectionObserver once — the ref pattern means it never needs to re-run
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMoreFn.current?.(); },
      { rootMargin: '400px' }
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, []);

  const items = applyInterestFilter(allItems, interests, filters.interest_id);
  const isEmpty = !loading && items.length === 0;

  return (
    // feed-layout--split is added when a panel is open; CSS handles desktop vs mobile
    <div className={`feed-layout${isPanelOpen ? ' feed-layout--split' : ''}`}>
      {/* Grid column: always in the DOM so scroll position + state survive panel open/close */}
      <div className="feed-layout__grid">
        <div className="feed-page__inner">
          {banner && (
            <ErrorBanner message={banner} onDismiss={() => setBanner(null)} />
          )}

          <div className="feed-controls">
            <SearchInput onChange={q => setFilters(f => ({ ...f, q }))} />
            <FilterBar filters={filters} onChange={setFilters} interests={interests} />
          </div>

          {loading ? (
            <div className="item-grid">
              {Array.from({ length: 6 }, (_, i) => <LoadingSkeleton key={i} />)}
            </div>
          ) : isEmpty ? (
            <EmptyState
              heading="No items match these filters yet"
              body={
                filters.interest_id
                  ? "No items matched that interest's keywords. Try another interest or broaden your filters."
                  : "Try adjusting your filters, or add more interests in Library."
              }
            />
          ) : (
            <>
              <div className="item-grid">
                {items.map(item => <ItemCard key={item.id} item={item} />)}
                {loadingMore && Array.from({ length: 3 }, (_, i) => (
                  <LoadingSkeleton key={`more-${i}`} />
                ))}
              </div>
              {/* Sentinel triggers load-more when it scrolls into view */}
              <div ref={sentinelRef} className="feed-sentinel" aria-hidden="true" />
            </>
          )}
        </div>
      </div>

      {/* Detail panel: rendered only when /items/:id is matched */}
      {isPanelOpen && (
        <aside className="feed-layout__panel" aria-label="Item detail">
          <ItemDetailPanel externalId={activeItemId} />
        </aside>
      )}
    </div>
  );
}

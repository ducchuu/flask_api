const SOURCE_TYPES = [
  { value: '', label: 'All' },
  { value: 'news', label: 'News' },
  { value: 'video', label: 'Video' },
  { value: 'discussion', label: 'Discussion' },
];

// Shown in UI as a time window; converted to `days` integer before hitting the API
const WINDOWS = [
  { value: '', label: 'All' },
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
];

const SORTS = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'recency', label: 'Recency' },
];

export default function FilterBar({ filters, onChange, interests }) {
  return (
    <div className="filter-bar">
      {/* source_type — tab-style toggle */}
      <div className="filter-bar__group">
        {SOURCE_TYPES.map(({ value, label }) => (
          <button
            key={value}
            className={`filter-tab${filters.source_type === value ? ' filter-tab--active' : ''}`}
            onClick={() => onChange({ ...filters, source_type: value })}
          >
            {label}
          </button>
        ))}
      </div>

      {/* interest_id — client-side filter; backend doesn't accept an interest_id param */}
      <select
        className="filter-select"
        value={filters.interest_id}
        onChange={e => onChange({ ...filters, interest_id: e.target.value })}
        aria-label="Filter by interest"
      >
        <option value="">All interests</option>
        {interests.map(i => (
          <option key={i.id} value={String(i.id)}>{i.name}</option>
        ))}
      </select>

      {/* window — segmented control */}
      <div className="filter-bar__group">
        {WINDOWS.map(({ value, label }) => (
          <button
            key={value}
            className={`filter-seg${filters.window === value ? ' filter-seg--active' : ''}`}
            onClick={() => onChange({ ...filters, window: value })}
          >
            {label}
          </button>
        ))}
      </div>

      {/* sort — toggle */}
      <div className="filter-bar__group">
        {SORTS.map(({ value, label }) => (
          <button
            key={value}
            className={`filter-seg${filters.sort === value ? ' filter-seg--active' : ''}`}
            onClick={() => onChange({ ...filters, sort: value })}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

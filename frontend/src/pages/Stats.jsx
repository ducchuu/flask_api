import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  PieChart, Pie, Cell, Tooltip as RTooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line, Brush,
} from 'recharts';
import api from '../api/client';
import '../styles/stats.css';

// ── Theme-reactive colors ─────────────────────────────────────────────────────
// Recharts renders SVG fill attrs — CSS custom properties don't work there.

const DARK  = { news: '#5B8DEF', video: '#FF6B4A', discussion: '#3DD6B4', accent: '#FF6B4A', text: '#9AA5B1', grid: 'rgba(255,255,255,0.08)', brushBg: 'rgba(255,255,255,0.04)' };
const LIGHT = { news: '#3D6FD1', video: '#E85A3B', discussion: '#1FA98A', accent: '#E85A3B', text: '#5B6470', grid: 'rgba(15,20,25,0.10)', brushBg: 'rgba(15,20,25,0.03)' };

function resolveColors() {
  return (document.documentElement.dataset.theme ?? 'dark') === 'light' ? LIGHT : DARK;
}

function useThemeColors() {
  const [c, setC] = useState(resolveColors);
  useEffect(() => {
    const obs = new MutationObserver(() => setC(resolveColors()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);
  return c;
}

// ── Shared constants ──────────────────────────────────────────────────────────

const SOURCE_LABELS = { news: 'News', video: 'Video', discussion: 'Discussion' };

const TABS = [
  { id: 'source_type', label: 'Source Type' },
  { id: 'interest',    label: 'Interest'    },
  { id: 'day',         label: 'Daily Trend' },
];

function fmtDay(dayStr) {
  const d = new Date(dayStr + 'T12:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function toErrMsg(err) {
  if (err?.status === 429) return 'Temporarily unavailable — try again in a moment.';
  if (err?.status === 502) return "Can't reach data source right now.";
  return err?.message ?? 'Failed to load.';
}

// ── Small shared UI ───────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="stats-tooltip">
      {label && <p className="stats-tooltip__label">{label}</p>}
      <p className="stats-tooltip__val"><strong>{payload[0].value}</strong> items</p>
    </div>
  );
}

function InsightCard({ label, value, sub }) {
  return (
    <div className="stats-insight-card">
      <span className="stats-insight-card__value">{value}</span>
      <span className="stats-insight-card__label">{label}</span>
      {sub && <span className="stats-insight-card__sub">{sub}</span>}
    </div>
  );
}

function InsightCardsSkeleton({ count = 3 }) {
  return (
    <div className="stats-insights">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="stats-insight-card">
          <div className="stats-insight-skeleton stats-insight-skeleton--val" />
          <div className="stats-insight-skeleton stats-insight-skeleton--label" />
        </div>
      ))}
    </div>
  );
}

function ChartSkeleton({ type }) {
  if (type === 'source_type') {
    return (
      <div className="stats-skeleton stats-skeleton--donut" aria-hidden="true">
        <div className="stats-skeleton__ring" />
      </div>
    );
  }
  if (type === 'interest') {
    return (
      <div className="stats-skeleton stats-skeleton--bars" aria-hidden="true">
        {[90, 68, 52, 38, 24].map((w, i) => (
          <div key={i} className="stats-skeleton__bar" style={{ width: `${w}%` }} />
        ))}
      </div>
    );
  }
  return <div className="stats-skeleton stats-skeleton--line" aria-hidden="true" />;
}

// ── Breakdown table (Source Type only) ───────────────────────────────────────

function BreakdownTable({ data, colors }) {
  const sorted = [...data.stats].sort((a, b) => b.count - a.count);
  const total  = data.total;
  return (
    <div className="stats-breakdown">
      {sorted.map(row => {
        const pct   = total > 0 ? ((row.count / total) * 100).toFixed(1) : '0.0';
        const color = colors[row.source_type] ?? colors.accent;
        const label = SOURCE_LABELS[row.source_type] ?? row.source_type;
        return (
          <div key={row.source_type} className="stats-breakdown__row">
            <span className="stats-breakdown__label">
              <span className="stats-breakdown__dot" style={{ background: color }} />
              {label}
            </span>
            <span className="stats-breakdown__count">{row.count.toLocaleString()}</span>
            <span className="stats-breakdown__pct">{pct}%</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Charts ────────────────────────────────────────────────────────────────────

function SourceTypeChart({ data, colors }) {
  const slices = data.stats.map(d => ({
    name:  SOURCE_LABELS[d.source_type] ?? d.source_type,
    key:   d.source_type,
    value: d.count,
  }));
  return (
    <div className="stats-source-layout">
      <div className="stats-donut-col">
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie
              data={slices}
              cx="50%" cy="50%"
              innerRadius="50%" outerRadius="72%"
              dataKey="value" nameKey="name"
              paddingAngle={3} startAngle={90} endAngle={-270}
            >
              {slices.map(entry => (
                <Cell key={entry.key} fill={colors[entry.key] ?? colors.accent} />
              ))}
            </Pie>
            <RTooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="stats-legend">
          {slices.map(entry => (
            <div key={entry.key} className="stats-legend__item">
              <span className="stats-legend__dot" style={{ background: colors[entry.key] ?? colors.accent }} />
              <span className="stats-legend__name">{entry.name}</span>
              <span className="stats-legend__count">{entry.value}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="stats-breakdown-col">
        <p className="stats-breakdown__heading">Breakdown</p>
        <BreakdownTable data={data} colors={colors} />
      </div>
    </div>
  );
}

function InterestChart({ data, colors }) {
  if (data.stats.length === 0) {
    return (
      <div className="stats-empty">
        <p className="stats-empty__text">Not enough data yet — try following some interests.</p>
        <Link to="/library" className="stats-link-btn">Manage interests →</Link>
      </div>
    );
  }
  const sorted = [...data.stats].sort((a, b) => b.count - a.count);
  const chartH = Math.max(220, sorted.length * 48 + 48);
  const yWidth = Math.max(100, Math.min(180,
    sorted.reduce((m, d) => Math.max(m, d.interest.length), 0) * 7.5
  ));
  return (
    <div className="stats-chart-wrap">
      <ResponsiveContainer width="100%" height={chartH}>
        <BarChart data={sorted} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} horizontal={false} />
          <XAxis type="number" stroke={colors.grid} tick={{ fill: colors.text, fontSize: 12 }} tickLine={false} allowDecimals={false} />
          <YAxis type="category" dataKey="interest" width={yWidth} stroke="transparent" tick={{ fill: colors.text, fontSize: 13 }} />
          <RTooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          <Bar dataKey="count" name="Items" fill={colors.accent} radius={[0, 6, 6, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function DayChart({ data, colors }) {
  const sorted = [...data.stats].sort((a, b) => a.day.localeCompare(b.day));
  return (
    <div className="stats-chart-wrap">
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={sorted} margin={{ top: 8, right: 24, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
          <XAxis dataKey="day" stroke={colors.grid} tick={{ fill: colors.text, fontSize: 11 }} tickLine={false} />
          <YAxis stroke={colors.grid} tick={{ fill: colors.text, fontSize: 12 }} tickLine={false} allowDecimals={false} />
          <RTooltip content={<ChartTooltip />} />
          <Line
            type="monotone" dataKey="count" name="Items"
            stroke={colors.accent} strokeWidth={2.5}
            dot={{ r: 4, fill: colors.accent, strokeWidth: 0 }}
            activeDot={{ r: 6, strokeWidth: 0 }}
          />
          {/* Client-side zoom — no new API calls */}
          <Brush dataKey="day" height={28} stroke={colors.grid} fill={colors.brushBg} travellerWidth={8} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Stats() {
  const colors = useThemeColors();

  // All three sections load independently in parallel on mount
  const [sections, setSections] = useState({
    source_type: { data: null, loading: true, error: null },
    interest:    { data: null, loading: true, error: null },
    day:         { data: null, loading: true, error: null },
  });

  // "active" tab just tracks what was last clicked — used for tab highlight only
  const [activeTab, setActiveTab] = useState('source_type');

  const sourceRef   = useRef(null);
  const interestRef = useRef(null);
  const dayRef      = useRef(null);
  const SECTION_REFS = { source_type: sourceRef, interest: interestRef, day: dayRef };

  useEffect(() => {
    ['source_type', 'interest', 'day'].forEach(by => {
      api.get('/api/items/stats', { by })
        .then(data => setSections(prev => ({ ...prev, [by]: { data, loading: false, error: null } })))
        .catch(err  => setSections(prev => ({ ...prev, [by]: { data: null, loading: false, error: toErrMsg(err) } })));
    });
  }, []);

  function scrollTo(id) {
    setActiveTab(id);
    SECTION_REFS[id].current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const st  = sections.source_type;
  const int = sections.interest;
  const dy  = sections.day;

  // Derived insight values — computed only when data is present
  const stSorted    = st.data  ? [...st.data.stats].sort((a, b) => b.count - a.count)  : [];
  const stTop       = stSorted[0];
  const stBot       = stSorted[stSorted.length - 1];
  const stShowLeast = stSorted.length > 1 && stBot?.count !== stTop?.count;

  const intSorted = int.data ? [...int.data.stats].sort((a, b) => b.count - a.count) : [];
  const intTop    = intSorted[0];

  const dyPeak = dy.data?.stats.length
    ? dy.data.stats.reduce((m, d) => d.count > m.count ? d : m, dy.data.stats[0])
    : null;
  const dyAvg  = dy.data?.stats.length
    ? (dy.data.total / dy.data.stats.length).toFixed(1)
    : null;

  return (
    <div className="stats-page">

      {/* Sticky tab bar — clicking jumps to the corresponding section */}
      <div className="stats-header">
        <nav className="stats-tabs" aria-label="Jump to section">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`stats-tab${activeTab === t.id ? ' stats-tab--active' : ''}`}
              onClick={() => scrollTo(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ── Section 1: Source Type ────────────────────────────────────────── */}
      <section ref={sourceRef} id="stats-source-type" className="stats-section">
        <h2 className="stats-section__title">Source Type</h2>

        {st.loading ? (
          <InsightCardsSkeleton count={3} />
        ) : st.data ? (
          <div className="stats-insights">
            <InsightCard label="Total items" value={st.data.total.toLocaleString()} />
            {stTop && (
              <InsightCard
                label="Leading source"
                value={SOURCE_LABELS[stTop.source_type] ?? stTop.source_type}
                sub={`${stTop.count.toLocaleString()} items`}
              />
            )}
            {stShowLeast && stBot && (
              <InsightCard
                label="Least active"
                value={SOURCE_LABELS[stBot.source_type] ?? stBot.source_type}
                sub={`${stBot.count.toLocaleString()} items`}
              />
            )}
          </div>
        ) : null}

        {st.error ? (
          <p className="stats-section__error" role="alert">{st.error}</p>
        ) : (
          <div className="stats-chart-area">
            {st.loading
              ? <ChartSkeleton type="source_type" />
              : <SourceTypeChart data={st.data} colors={colors} />
            }
          </div>
        )}
      </section>

      {/* ── Section 2: By Interest ───────────────────────────────────────── */}
      <section ref={interestRef} id="stats-interest" className="stats-section">
        <h2 className="stats-section__title">By Interest</h2>

        {int.loading ? (
          <InsightCardsSkeleton count={2} />
        ) : int.data && int.data.stats.length > 0 ? (
          <div className="stats-insights">
            {intTop && (
              <InsightCard
                label="Top interest"
                value={intTop.interest}
                sub={`${intTop.count.toLocaleString()} items`}
              />
            )}
            <InsightCard
              label="Interests tracked"
              value={String(int.data.stats.length)}
            />
          </div>
        ) : null}

        {int.error ? (
          <p className="stats-section__error" role="alert">{int.error}</p>
        ) : (
          <div className="stats-chart-area">
            {int.loading
              ? <ChartSkeleton type="interest" />
              : <InterestChart data={int.data} colors={colors} />
            }
          </div>
        )}
      </section>

      {/* ── Section 3: Daily Trend ───────────────────────────────────────── */}
      <section ref={dayRef} id="stats-day" className="stats-section">
        <h2 className="stats-section__title">Daily Trend</h2>

        {dy.loading ? (
          <InsightCardsSkeleton count={3} />
        ) : dy.data ? (
          <div className="stats-insights">
            {dyPeak && (
              <InsightCard
                label="Most active day"
                value={fmtDay(dyPeak.day)}
                sub={`${dyPeak.count} items`}
              />
            )}
            {dyAvg && (
              <InsightCard
                label="Daily average"
                value={dyAvg}
                sub="items per day"
              />
            )}
            {dy.data.stats.length > 0 && (
              <InsightCard
                label="Active days"
                value={String(dy.data.stats.length)}
                sub="in last 30 days"
              />
            )}
          </div>
        ) : null}

        {dy.error ? (
          <p className="stats-section__error" role="alert">{dy.error}</p>
        ) : (
          <div className="stats-chart-area">
            {dy.loading
              ? <ChartSkeleton type="day" />
              : <DayChart data={dy.data} colors={colors} />
            }
          </div>
        )}
      </section>

    </div>
  );
}

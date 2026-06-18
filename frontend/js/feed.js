/**
 * Shared feed helpers used by the dashboard, search and story views:
 * client-side clustering of items into multi-source stories, keyword cleaning,
 * story-card rendering, and the chart data (computed from what's on screen).
 */
import { esc, icon, sourceBadge, timeAgo, sentimentTag, SOURCE_LABEL } from "./ui.js";

const SOURCE_COLOR = { news: "#5b8cff", video: "#ff6b8b", discussion: "#46d6c4" };

// Web/markup artefacts and generic words that pollute real-world keywords.
const JUNK = new Set([
  "https", "http", "www", "com", "org", "net", "html", "amp", "href", "utm",
  "watch", "youtube", "youtu", "wikipedia", "lemmy", "reddit", "co", "uk",
]);
const STOP = new Set([
  "the", "and", "for", "are", "but", "not", "you", "all", "any", "can", "had",
  "her", "was", "one", "our", "out", "has", "his", "how", "new", "now", "old",
  "see", "two", "way", "who", "boy", "did", "its", "let", "put", "say", "she",
  "too", "use", "that", "this", "with", "from", "they", "will", "have", "what",
  "been", "more", "when", "your", "said", "says", "than", "then", "them", "into",
  "just", "like", "over", "also", "back", "after", "could", "would", "about",
  "which", "their", "there", "these", "those", "where", "while", "year", "years",
  "make", "made", "many", "most", "some", "such", "time", "week", "today", "first",
  // months + date words (kept tags like "#june" out of topics)
  "january", "february", "march", "april", "may", "june", "july", "august",
  "september", "october", "november", "december", "jan", "feb", "mar", "apr",
  "jun", "jul", "aug", "sep", "sept", "oct", "nov", "dec", "monday", "tuesday",
  "wednesday", "thursday", "friday", "saturday", "sunday", "yesterday", "tomorrow",
  // generic noise seen in real tags
  "hid", "secret", "didyouknow", "watch", "video", "news", "post", "read",
  "report", "update", "story", "thread", "discussion", "via", "amp", "really",
  "people", "things", "going", "good", "best", "here", "very", "much", "still",
]);

/** Clean an item's keywords (plus a few title tokens) into useful topic words. */
export function cleanTokens(item) {
  const fromKw = (item.keywords || []).map((k) => String(k).toLowerCase());
  const fromTitle = (item.title || "").toLowerCase().split(/[^a-z]+/);
  const out = new Set();
  for (const t of [...fromKw, ...fromTitle]) {
    if (t.length < 3) continue;
    if (!/^[a-z]+$/.test(t)) continue;
    if (JUNK.has(t) || STOP.has(t)) continue;
    out.add(t);
  }
  return [...out];
}

function jaccard(a, b) {
  const A = new Set(a), B = new Set(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

/**
 * Flatten the server's stories, de-duplicate, and re-cluster items that are
 * about the same thing into a single multi-source story. Re-clustering on the
 * client (with cleaned keywords + a tuned threshold) groups real, diverse feed
 * items far better than the server's clustering does on noisy live text.
 */
export function clusterStories(stories, threshold = 0.18) {
  const seen = new Set();
  const items = [];
  for (const s of stories || []) {
    for (const it of s.items || []) {
      const key = String(it.external_id || it.id || it.url || it.title || "").toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({ ...it, _toks: cleanTokens(it) });
    }
  }

  const clusters = [];
  for (const it of items) {
    let best = null, bestScore = threshold;
    for (const c of clusters) {
      const score = jaccard(it._toks, c._toks);
      if (score >= bestScore) { bestScore = score; best = c; }
    }
    if (best) {
      best.items.push(it);
      best._toks = [...new Set([...best._toks, ...it._toks])];
    } else {
      clusters.push({ id: `story-${clusters.length + 1}`, _toks: [...it._toks], items: [it] });
    }
  }
  return clusters.map((c) => ({ id: c.id, keywords: c._toks, items: c.items }));
}

const pop = (it) => {
  const m = it.metrics || {};
  return m.views || m.shares || (m.upvotes || 0) + (m.comments || 0) || 0;
};
const maxRelevance = (s) => Math.max(...s.items.map((i) => i.relevance_score || 0), 0);
const newestIso = (s) => s.items.map((i) => i.published_at || "").sort().slice(-1)[0] || "";

/** Freshness 0..1 with a ~7-day half-life on the story's newest item. */
function freshness(s) {
  const iso = newestIso(s);
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  const ageDays = Math.max(0, (Date.now() - t) / 86400000);
  return Math.pow(0.5, ageDays / 7);
}

/**
 * "Best" = a blend that rewards relevant, reasonably fresh, multi-source
 * stories — the balanced default. Pure relevance/recency/popularity remain
 * available as explicit options.
 */
function bestScore(s) {
  const diversity = (new Set(s.items.map((i) => i.source_type)).size - 1) / 2; // 0..1
  return 0.6 * maxRelevance(s) + 0.25 * freshness(s) + 0.15 * Math.min(diversity, 1);
}

/** Sort clustered stories by the chosen order, using their strongest item. */
export function sortStories(stories, sort = "best") {
  const keyOf = {
    best: bestScore,
    relevance: maxRelevance,
    recency: newestIso,
    popularity: (s) => Math.max(...s.items.map(pop), 0),
  }[sort] || bestScore;
  return [...stories].sort((a, b) => (keyOf(a) < keyOf(b) ? 1 : keyOf(a) > keyOf(b) ? -1 : 0));
}

/** The most relevant item in a story represents it on the card. */
export function leadItem(story) {
  const items = story.items || [];
  return items.reduce((best, it) =>
    (it.relevance_score || 0) > (best?.relevance_score || 0) ? it : best, items[0]) || {};
}

export function distinctSources(story) {
  return [...new Set((story.items || []).map((i) => i.source_type))];
}

/** Trim text to a word boundary near n chars, adding an ellipsis if cut. */
export function clip(text, n = 180) {
  const t = (text || "").trim();
  if (t.length <= n) return t;
  const cut = t.slice(0, n);
  const lastSpace = cut.lastIndexOf(" ");
  return cut.slice(0, lastSpace > 40 ? lastSpace : n).replace(/[\s.,;:!?-]+$/, "") + "…";
}

/** Render one story as a card. */
export function storyCardHtml(story) {
  const lead = leadItem(story);
  const sources = distinctSources(story);
  const score = Math.round((lead.relevance_score || 0) * 100);
  const strip = sources.map((s) => `<i style="background:${SOURCE_COLOR[s] || "#888"}"></i>`).join("");
  const count = (story.items || []).length;

  const stripTitle = "Sources in this story: " + sources.map((s) => SOURCE_LABEL[s] || s).join(", ");
  return `
    <article class="card interactive story-card" data-story="${esc(story.id)}">
      <div class="src-strip" title="${esc(stripTitle)}">${strip}</div>
      <div class="row wrap" style="gap:6px;margin-bottom:10px">
        ${sources.map(sourceBadge).join("")}
        ${count > 1 ? `<span class="chip tiny"><span class="source-count">${icon("layers")} ${count} sources</span></span>` : ""}
        <button class="icon-btn card-save" title="Save to collection" aria-label="Save to collection" style="margin-left:auto">${icon("bookmark")}</button>
      </div>
      <h3>${esc(lead.title || "Untitled")}</h3>
      <p class="summary">${esc(clip(lead.summary || lead.text, 180))}</p>
      <div class="relbar" title="Relevance ${score} out of 100"><i style="width:${score}%"></i></div>
      <div class="meta">
        ${sentimentTag(lead.sentiment)}
        <span>${icon("clock", "ic")} ${lead.read_time || 1} min</span>
        <span>${timeAgo(lead.published_at)}</span>
        <span class="mono" style="margin-left:auto" title="Relevance score out of 100">relevance ${score}/100</span>
      </div>
    </article>`;
}

/** Flatten all items across the visible stories. */
export function allItems(stories) {
  return stories.flatMap((s) => s.items || []);
}

/**
 * Narrow stories to those with an item matching the query. Searches title,
 * summary, body text and source name; every whitespace-separated term must
 * appear somewhere so multi-word queries stay precise.
 */
export function filterByText(stories, query) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return stories;
  const matches = (it) => {
    const hay = [it.title, it.summary, it.text, it.source_name].join(" ").toLowerCase();
    return terms.every((t) => hay.includes(t));
  };
  return stories
    .map((s) => ({ ...s, items: (s.items || []).filter(matches) }))
    .filter((s) => s.items.length > 0);
}

export function sourceMix(stories) {
  const items = allItems(stories);
  return ["news", "video", "discussion"].map((s) => ({
    label: s[0].toUpperCase() + s.slice(1),
    key: s,
    value: items.filter((i) => i.source_type === s).length,
    color: SOURCE_COLOR[s],
  }));
}

/** Ordered, cleaned tokens from a title (keeps adjacency for phrase detection). */
function titleTokens(item) {
  return (item.title || "")
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((t) => t.length >= 3 && !JUNK.has(t) && !STOP.has(t));
}

const titleCase = (s) => s.replace(/\b[a-z]/g, (c) => c.toUpperCase());

/**
 * Top topics, preferring multi-word phrases. We count adjacent word pairs
 * (bigrams) from titles and keep the recurring ones, so "Artificial
 * Intelligence" stays a single topic rather than splitting into
 * "artificial" + "intelligence". Component words of a kept phrase are then
 * suppressed from the single-word list.
 */
export function topicMix(stories, limit = 6) {
  const uni = new Map();
  const bi = new Map();
  for (const it of allItems(stories)) {
    const toks = titleTokens(it);
    toks.forEach((t) => uni.set(t, (uni.get(t) || 0) + 1));
    for (let i = 0; i < toks.length - 1; i++) {
      const pair = toks[i] + " " + toks[i + 1];
      bi.set(pair, (bi.get(pair) || 0) + 1);
    }
  }

  const out = [];
  const used = new Set();
  for (const [pair, v] of [...bi.entries()].sort((a, b) => b[1] - a[1])) {
    if (v < 2) break; // only recurring phrases
    const [a, b] = pair.split(" ");
    used.add(a); used.add(b);
    out.push({ label: titleCase(pair), value: v });
  }
  for (const [w, v] of [...uni.entries()].sort((a, b) => b[1] - a[1])) {
    if (v < 2 || used.has(w)) continue;
    out.push({ label: titleCase(w), value: v });
  }
  return out.sort((a, b) => b.value - a.value).slice(0, limit);
}

function itemDates(stories) {
  return allItems(stories)
    .map((i) => new Date(i.published_at))
    .filter((d) => !Number.isNaN(d.getTime()));
}

/** Pick a sensible bucket size from how far apart the items' dates are. */
export function effectiveGranularity(stories, pref = "auto") {
  if (pref !== "auto") return pref;
  const dates = itemDates(stories);
  if (!dates.length) return "day";
  const span = (Math.max(...dates) - Math.min(...dates)) / 86400000;
  return span <= 21 ? "day" : span <= 180 ? "week" : "month";
}

function bucketKey(d, gran) {
  if (gran === "month") return d.toISOString().slice(0, 7);
  if (gran === "week") {
    const t = new Date(d);
    t.setDate(t.getDate() - t.getDay()); // back to Sunday
    return t.toISOString().slice(0, 10);
  }
  return d.toISOString().slice(0, 10);
}

function bucketLabel(key, gran, withYear) {
  if (gran === "month") {
    const [y, m] = key.split("-");
    return new Date(Date.UTC(y, m - 1, 1))
      .toLocaleDateString(undefined, { month: "short", year: "2-digit", timeZone: "UTC" });
  }
  const opts = { month: "short", day: "numeric", timeZone: "UTC" };
  if (withYear) opts.year = "2-digit";
  return new Date(key + "T00:00:00Z").toLocaleDateString(undefined, opts);
}

// All bucket maths is done in UTC so the keys (from toISOString) and the
// generated bucket dates line up regardless of the viewer's timezone.
function alignBucket(d, gran) {
  const t = new Date(d);
  const y = t.getUTCFullYear(), m = t.getUTCMonth(), day = t.getUTCDate();
  if (gran === "month") return new Date(Date.UTC(y, m, 1));
  const x = new Date(Date.UTC(y, m, day));
  if (gran === "week") x.setUTCDate(x.getUTCDate() - x.getUTCDay());
  return x;
}
function stepBucket(d, gran) {
  const t = new Date(d);
  if (gran === "month") t.setUTCMonth(t.getUTCMonth() + 1);
  else t.setUTCDate(t.getUTCDate() + (gran === "week" ? 7 : 1));
  return t;
}

/**
 * Items per time bucket on a UNIFORM, continuous axis (empty buckets included
 * as zero) so the chart is honest about gaps. Buckets run at the chosen
 * granularity and are capped to the most recent N for readability.
 */
export function activity(stories, granularity = "auto") {
  const dates = itemDates(stories);
  if (!dates.length) return [];
  const gran = effectiveGranularity(stories, granularity);

  const start = alignBucket(new Date(Math.min(...dates)), gran);
  const end = alignBucket(new Date(Math.max(...dates)), gran);
  const keys = [];
  let cur = start, guard = 0;
  while (cur <= end && guard++ < 2000) { keys.push(bucketKey(cur, gran)); cur = stepBucket(cur, gran); }

  const cap = gran === "day" ? 30 : gran === "week" ? 26 : 24;
  const shown = keys.length > cap ? keys.slice(-cap) : keys;

  const counts = new Map(shown.map((k) => [k, 0]));
  for (const d of dates) {
    const k = bucketKey(d, gran);
    if (counts.has(k)) counts.set(k, counts.get(k) + 1);
  }
  const withYear = shown.length > 0 && shown[0].slice(0, 4) !== shown[shown.length - 1].slice(0, 4);
  return shown.map((k) => ({ label: bucketLabel(k, gran, withYear), value: counts.get(k) }));
}

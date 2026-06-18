/** Main dashboard: personalized feed + filters + the three visualizations. */
import { api, ApiError } from "../api.js";
import { store } from "../store.js";
import { navigate } from "../router.js";
import { icon, esc, toast, skeletonCards, emptyState } from "../ui.js";
import { storyCardHtml, sourceMix, topicMix, clusterStories, sortStories, filterByText, leadItem } from "../feed.js";
import { donut, bars } from "../charts.js";
import { openSaveModal, sendFeedback } from "../actions.js";

// view-local filter state
const state = { source: "", sort: "best", days: "", query: "", interest: "", topicSort: "desc" };

const SOURCE_LABEL = { news: "News", video: "Video", discussion: "Discussion" };

export async function renderDashboard(mount) {
  // interests power the "filter by interest" dropdown; non-fatal if it fails
  let interests = [];
  try { interests = await api.interests(); } catch { /* dropdown just won't show */ }

  mount.innerHTML = `
    <div class="section-title between" style="display:flex">
      <h2 class="h-lg">Your feed</h2>
      <span id="active-filter"></span>
    </div>
    ${filterBarHtml(interests)}
    <div id="charts" class="grid grid-2" style="margin-bottom:24px"></div>
    <div id="feed">${skeletonCards(6)}</div>`;

  wireFilters(mount);
  await loadFeed(mount);
}

function filterBarHtml(interests = []) {
  const seg = (group, opts) =>
    `<div class="segmented" data-group="${group}">` +
    opts.map(([v, l]) => `<button data-val="${v}" class="${state[group] === v ? "on" : ""}">${l}</button>`).join("") +
    `</div>`;
  const interestSel = interests.length
    ? `<select class="input" id="interest" style="width:auto" title="Focus the feed on one interest">
         <option value="">All interests</option>
         ${interests.map((i) => `<option value="${esc(i.name)}" ${state.interest === i.name ? "selected" : ""}>${esc(i.name)}</option>`).join("")}
       </select>`
    : "";
  return `
    <div class="filterbar">
      ${seg("source", [["", "All"], ["news", "News"], ["video", "Video"], ["discussion", "Discussion"]])}
      ${seg("sort", [["best", "Best"], ["relevance", "Relevance"], ["recency", "Recency"], ["popularity", "Popularity"]])}
      ${interestSel}
      <select class="input" id="days" style="width:auto">
        <option value="">Any time</option>
        <option value="1">Last 24h</option>
        <option value="7">Last 7 days</option>
        <option value="30">Last 30 days</option>
      </select>
      <button class="btn btn-ghost btn-sm" id="refresh" style="margin-left:auto">${icon("compass")} Get fresh sources</button>
    </div>`;
}

function wireFilters(mount) {
  mount.querySelectorAll(".segmented").forEach((seg) => {
    seg.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      state[seg.dataset.group] = btn.dataset.val;
      seg.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b === btn));
      loadFeed(mount);
    });
  });
  const interest = mount.querySelector("#interest");
  if (interest) interest.addEventListener("change", () => {
    state.interest = interest.value;
    state.query = ""; // focusing an interest replaces any topic/text filter
    loadFeed(mount);
  });
  const days = mount.querySelector("#days");
  days.value = state.days;
  days.addEventListener("change", () => { state.days = days.value; loadFeed(mount); });
  mount.querySelector("#refresh").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> Fetching...`;
    toast("Fetching fresh sources for your interests...", "info");
    await loadFeed(mount, true); // force = bust cache, fetch live
    btn.disabled = false;
    btn.innerHTML = `${icon("compass")} Get fresh sources`;
  });
}

// Show a clearable chip when a topic/text filter is active. Without this the
// filter is invisible (the dropdown still reads "All interests") so the feed
// looks mysteriously empty and "Get fresh sources" seems broken.
function updateActiveFilter(mount) {
  const el = mount.querySelector("#active-filter");
  if (!el) return;
  if (state.query) {
    el.innerHTML = `<span class="chip on">Topic: ${esc(state.query)}
      <button class="x" id="clear-filter" title="Clear topic filter" aria-label="Clear topic filter">✕</button></span>`;
    el.querySelector("#clear-filter").addEventListener("click", () => {
      state.query = "";
      loadFeed(mount);
    });
  } else {
    el.innerHTML = "";
  }
}

async function loadFeed(mount, force = false) {
  updateActiveFilter(mount);
  const feedEl = mount.querySelector("#feed");
  // On a forced refresh keep the current feed on screen until new data arrives,
  // so a failed/empty refresh doesn't wipe what the user was looking at.
  if (!force) feedEl.innerHTML = skeletonCards(6);
  try {
    // a chosen interest focuses the feed just like a search term does
    const q = state.interest || state.query;
    let stories = await api.items({ source: state.source, sort: state.sort, days: state.days, query: q, refresh: force ? 1 : "" });
    stories = clusterStories(stories);

    // client-side free-text narrowing (fixtures ignore the query param)
    if (q) stories = filterByText(stories, q);
    stories = sortStories(stories, state.sort);

    if (force && !stories.length) {
      toast("No fresh sources available right now — sources may be rate-limited. Try again shortly.", "info");
      return; // keep the existing feed
    }

    store.cacheFeed(stories);
    renderCharts(mount, stories);

    if (!stories.length) {
      feedEl.innerHTML = emptyState("compass", "No stories yet",
        "Try clearing filters, widening the time window, or adding interests.",
        `<a class="btn btn-primary" href="#/settings">Manage interests</a>`);
      return;
    }
    feedEl.className = "grid grid-feed";
    feedEl.innerHTML = stories.map(storyCardHtml).join("");
    feedEl.querySelectorAll(".story-card").forEach((c, i) => {
      const lead = leadItem(stories[i]);
      c.addEventListener("click", () => navigate(`/story/${encodeURIComponent(c.dataset.story)}`));
      c.querySelector(".card-save").addEventListener("click", (e) => {
        e.stopPropagation(); // don't open the story
        openSaveModal(lead);
      });
      // up / down / hide on the story itself, acting on its lead item
      c.querySelectorAll(".card-fb").forEach((btn) =>
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const kind = btn.dataset.act;
          sendFeedback(lead, kind, btn);
          if (kind === "hide") {
            c.style.transition = "opacity .25s, transform .25s";
            c.style.opacity = "0";
            c.style.transform = "scale(.98)";
            setTimeout(() => c.remove(), 250);
          }
        }));
    });
  } catch (err) {
    feedEl.className = "";
    feedEl.innerHTML = emptyState("x", "Couldn't load your feed",
      err instanceof ApiError ? err.message : "Unexpected error.",
      `<button class="btn btn-ghost" onclick="location.reload()">Retry</button>`);
  }
}

function renderCharts(mount, stories) {
  const wrap = mount.querySelector("#charts");
  const total = stories.reduce((n, s) => n + (s.items || []).length, 0);

  // When a source filter is active the donut is just one blob, so show a clear
  // "filtered" panel with a way out instead.
  const sourceCard = state.source
    ? `<div class="card chart-card">
         <div class="chart-head"><h3>Source filter</h3></div>
         <div class="filtered-note">
           <span class="badge badge-${state.source}">${icon(state.source)} ${SOURCE_LABEL[state.source]}</span>
           <div class="value mono">${total}</div><div class="tiny muted-3">items shown</div>
           <button class="btn btn-ghost btn-sm" id="clear-source">Show all sources</button>
         </div>
       </div>`
    : `<div class="card chart-card">
         <div class="chart-head"><h3>Source mix</h3><span class="tiny muted-3">${total} items · click to filter</span></div>
         <div id="c-source"></div>
       </div>`;

  wrap.innerHTML = `
    ${sourceCard}
    <div class="card chart-card">
      <div class="chart-head"><h3>Top topics</h3>
        <button class="btn btn-subtle btn-sm" id="topic-sort">${state.topicSort === "desc" ? icon("down") : icon("up")} sort</button>
      </div>
      <div id="c-topics"></div>
    </div>`;

  if (state.source) {
    wrap.querySelector("#clear-source").addEventListener("click", () => {
      state.source = "";
      syncSegments(mount);
      loadFeed(mount);
    });
  } else {
    donut(wrap.querySelector("#c-source"), sourceMix(stories), {
      onSelect: (label) => {
        const key = label.toLowerCase();
        state.source = state.source === key ? "" : key; // click again to clear
        syncSegments(mount);
        loadFeed(mount);
        toast(state.source ? `Filtered to ${label}` : "Showing all sources", "info");
      },
    });
  }

  let topics = topicMix(stories);
  if (state.topicSort === "asc") topics = [...topics].reverse();
  bars(wrap.querySelector("#c-topics"), topics, {
    onSelect: (label) => {
      state.query = label;
      state.interest = ""; // a topic click replaces an interest focus
      const sel = mount.querySelector("#interest");
      if (sel) sel.value = "";
      loadFeed(mount);
      toast(`Filtered by "${label}"`, "info");
    },
  });

  wrap.querySelector("#topic-sort").addEventListener("click", () => {
    state.topicSort = state.topicSort === "desc" ? "asc" : "desc";
    renderCharts(mount, stories);
  });
}

function syncSegments(mount) {
  mount.querySelectorAll('.segmented[data-group="source"] button').forEach((b) =>
    b.classList.toggle("on", b.dataset.val === state.source));
}

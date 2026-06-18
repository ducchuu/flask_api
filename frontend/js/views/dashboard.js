/** Main dashboard: personalized feed + filters + the three visualizations. */
import { api, ApiError } from "../api.js";
import { store } from "../store.js";
import { navigate } from "../router.js";
import { icon, esc, toast, skeletonCards, emptyState } from "../ui.js";
import { storyCardHtml, sourceMix, topicMix, clusterStories, sortStories, filterByText, leadItem } from "../feed.js";
import { donut, bars } from "../charts.js";
import { openSaveModal } from "../actions.js";

// view-local filter state
const state = { source: "", sort: "best", days: "", query: "", topicSort: "desc" };

const SOURCE_LABEL = { news: "News", video: "Video", discussion: "Discussion" };

export async function renderDashboard(mount) {
  mount.innerHTML = `
    <div class="section-title"><h2 class="h-lg">Your feed</h2></div>
    ${filterBarHtml()}
    <div id="charts" class="grid grid-2" style="margin-bottom:24px"></div>
    <div id="feed">${skeletonCards(6)}</div>`;

  wireFilters(mount);
  await loadFeed(mount);
}

function filterBarHtml() {
  const seg = (group, opts) =>
    `<div class="segmented" data-group="${group}">` +
    opts.map(([v, l]) => `<button data-val="${v}" class="${state[group] === v ? "on" : ""}">${l}</button>`).join("") +
    `</div>`;
  return `
    <div class="filterbar">
      ${seg("source", [["", "All"], ["news", "News"], ["video", "Video"], ["discussion", "Discussion"]])}
      ${seg("sort", [["best", "Best"], ["relevance", "Relevance"], ["recency", "Recency"], ["popularity", "Popularity"]])}
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

async function loadFeed(mount, force = false) {
  const feedEl = mount.querySelector("#feed");
  // On a forced refresh keep the current feed on screen until new data arrives,
  // so a failed/empty refresh doesn't wipe what the user was looking at.
  if (!force) feedEl.innerHTML = skeletonCards(6);
  try {
    let stories = await api.items({ source: state.source, sort: state.sort, days: state.days, query: state.query, refresh: force ? 1 : "" });
    stories = clusterStories(stories);

    // client-side free-text narrowing (fixtures ignore the query param)
    if (state.query) stories = filterByText(stories, state.query);
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
      c.addEventListener("click", () => navigate(`/story/${encodeURIComponent(c.dataset.story)}`));
      c.querySelector(".card-save").addEventListener("click", (e) => {
        e.stopPropagation(); // don't open the story
        openSaveModal(leadItem(stories[i]));
      });
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
    onSelect: (label) => { state.query = label; loadFeed(mount); toast(`Filtered by "${label}"`, "info"); },
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

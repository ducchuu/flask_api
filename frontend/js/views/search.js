/** Search page: free-text query + three filters (source, freshness, sort). */
import { api, ApiError } from "../api.js";
import { store } from "../store.js";
import { navigate } from "../router.js";
import { icon, esc, skeletonCards, emptyState } from "../ui.js";
import { storyCardHtml, clusterStories, sortStories, filterByText, leadItem } from "../feed.js";
import { openSaveModal } from "../actions.js";

export async function renderSearch(mount) {
  const initialQ = new URLSearchParams(location.hash.split("?")[1] || "").get("q") || "";
  const state = { query: initialQ, source: "", days: "", sort: "relevance" };

  mount.innerHTML = `
    <div class="section-title"><h2 class="h-lg">Search</h2></div>
    <form id="search-form" class="card" style="margin-bottom:24px">
      <div class="search-input-lg">
        ${icon("search")}
        <input id="q" value="${esc(initialQ)}" placeholder="Search across news, video and discussion..." />
      </div>
      <div class="filterbar" style="margin:14px 0 0">
        <select class="input" id="f-source" style="width:auto">
          <option value="">All sources</option><option value="news">News</option>
          <option value="video">Video</option><option value="discussion">Discussion</option>
        </select>
        <select class="input" id="f-days" style="width:auto">
          <option value="">Any time</option><option value="1">Last 24h</option>
          <option value="7">Last 7 days</option><option value="30">Last 30 days</option>
        </select>
        <select class="input" id="f-sort" style="width:auto">
          <option value="best">Best</option><option value="relevance">Relevance</option>
          <option value="recency">Recency</option><option value="popularity">Popularity</option>
        </select>
        <button class="btn btn-primary" type="submit">Search</button>
      </div>
    </form>
    <div id="results"></div>`;

  const resultsEl = mount.querySelector("#results");
  const form = mount.querySelector("#search-form");

  async function run() {
    state.query = mount.querySelector("#q").value.trim();
    state.source = mount.querySelector("#f-source").value;
    state.days = mount.querySelector("#f-days").value;
    state.sort = mount.querySelector("#f-sort").value;

    resultsEl.innerHTML = skeletonCards(6);
    try {
      let stories = await api.items({ query: state.query, source: state.source, days: state.days, sort: state.sort });
      stories = clusterStories(stories);
      if (state.query) stories = filterByText(stories, state.query);
      stories = sortStories(stories, state.sort);
      store.cacheFeed(stories);

      if (!stories.length) {
        resultsEl.className = "";
        resultsEl.innerHTML = emptyState("search", "No matches",
          state.query ? `Nothing found for "${state.query}". Try a broader term.` : "Type a query to begin.");
        return;
      }
      resultsEl.className = "grid grid-feed";
      resultsEl.innerHTML = stories.map(storyCardHtml).join("");
      resultsEl.querySelectorAll(".story-card").forEach((c, i) => {
        c.addEventListener("click", () => navigate(`/story/${encodeURIComponent(c.dataset.story)}`));
        c.querySelector(".card-save").addEventListener("click", (e) => {
          e.stopPropagation();
          openSaveModal(leadItem(stories[i]));
        });
      });
    } catch (err) {
      resultsEl.className = "";
      resultsEl.innerHTML = emptyState("x", "Search failed",
        err instanceof ApiError ? err.message : "Unexpected error.");
    }
  }

  form.addEventListener("submit", (e) => { e.preventDefault(); run(); });
  if (initialQ) run();
  else resultsEl.innerHTML = emptyState("search", "Search Pulse",
    "Find stories across all your sources. Use the filters to narrow by source, freshness, or sort order.");
}

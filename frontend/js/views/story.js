/** Story detail: every clustered source for one event, with save + feedback. */
import { api } from "../api.js";
import { store } from "../store.js";
import { navigate } from "../router.js";
import { icon, esc, timeAgo, sourceBadge, sentimentTag, tierTag, toast, skeletonCards, emptyState } from "../ui.js";
import { distinctSources, leadItem, clusterStories, clip } from "../feed.js";
import { openSaveModal, sendFeedback } from "../actions.js";

export async function renderStory(mount, route) {
  const id = decodeURIComponent(route.parts[1] || "");
  mount.innerHTML = skeletonCards(2);

  let story = store.storiesById.get(id);
  if (!story) {
    // arrived via refresh/deep link: rebuild the feed cache, then look up
    try {
      const stories = await api.items({});
      store.cacheFeed(clusterStories(stories));
      story = store.storiesById.get(id);
    } catch { /* handled below */ }
  }

  if (!story) {
    mount.innerHTML = emptyState("compass", "Story not found",
      "It may have rolled off your feed. Head back to the dashboard.",
      `<a class="btn btn-primary" href="#/dashboard">Back to dashboard</a>`);
    return;
  }

  const lead = leadItem(story);
  const sources = distinctSources(story);
  const items = [...(story.items || [])].sort((a, b) => (b.relevance_score || 0) - (a.relevance_score || 0));

  mount.innerHTML = `
    <button class="btn btn-subtle btn-sm" id="back" style="margin-bottom:16px">${icon("up")} Back</button>
    <div class="card" style="margin-bottom:24px">
      <div class="row wrap" style="gap:6px;margin-bottom:12px">${sources.map(sourceBadge).join("")}
        <span class="chip tiny">${icon("layers")} ${items.length} ${items.length === 1 ? "source" : "sources"}</span></div>
      <div class="row between" style="gap:12px;align-items:flex-start">
        <h1 class="h-lg" style="margin-bottom:10px">${esc(lead.title || "Untitled story")}</h1>
        <button class="btn btn-primary btn-sm" id="save-story" style="flex:none">${icon("bookmark")} Save</button>
      </div>
      <p class="muted">${esc(clip(lead.text || lead.summary, 600))}</p>
      <div class="row wrap" style="gap:16px;margin-top:16px;color:var(--text-3)">
        ${sentimentTag(lead.sentiment)} ${tierTag(lead.credibility)}
        <span>${icon("clock", "ic")} ${lead.read_time || 1} min read</span>
      </div>
      ${story.keywords && story.keywords.length
        ? `<div class="row wrap" style="margin-top:14px">${story.keywords.slice(0, 5).map((k) => `<span class="chip tiny">#${esc(k)}</span>`).join("")}</div>` : ""}
    </div>

    <div class="section-title"><h2>All sources</h2></div>
    <div class="stack" id="items"></div>`;

  mount.querySelector("#back").addEventListener("click", () => navigate("/dashboard"));
  mount.querySelector("#save-story").addEventListener("click", () => openSaveModal(lead));

  const list = mount.querySelector("#items");
  list.innerHTML = items.map((it, i) => `
    <div class="card" data-i="${i}">
      <div class="row between" style="margin-bottom:8px">
        ${sourceBadge(it.source_type)}
        <span class="tiny muted-3">${esc(it.source_name || "")} · ${timeAgo(it.published_at)}</span>
      </div>
      <h3 style="font-size:1.05rem;margin-bottom:6px">${esc(it.title || "")}</h3>
      <p class="muted tiny" style="margin-bottom:12px">${esc(clip(it.text || it.summary, 320))}</p>
      <div class="row wrap" style="gap:8px">
        ${it.url ? `<a class="btn btn-ghost btn-sm" href="${esc(it.url)}" target="_blank" rel="noopener">${icon("external")} Open</a>` : ""}
        <button class="btn btn-ghost btn-sm" data-act="save">${icon("bookmark")} Save</button>
        <button class="btn btn-subtle btn-sm" data-act="more">▲ More like this</button>
        <button class="btn btn-subtle btn-sm" data-act="less">▼ Less</button>
        <button class="btn btn-subtle btn-sm" data-act="hide">${icon("x")} Hide</button>
      </div>
    </div>`).join("");

  list.querySelectorAll(".card").forEach((card, i) => {
    const it = items[i];
    card.querySelector('[data-act="save"]').addEventListener("click", () => openSaveModal(it));
    card.querySelector('[data-act="more"]').addEventListener("click", (e) => sendFeedback(it, "more", e.currentTarget));
    card.querySelector('[data-act="less"]').addEventListener("click", (e) => sendFeedback(it, "less", e.currentTarget));
    card.querySelector('[data-act="hide"]').addEventListener("click", (e) => {
      sendFeedback(it, "hide", e.currentTarget);
      card.style.transition = "opacity .25s, transform .25s";
      card.style.opacity = "0"; card.style.transform = "scale(.98)";
      setTimeout(() => card.remove(), 250);
    });
  });
}

/**
 * Actions on a feed item that need a persisted (numeric) item id: saving to a
 * collection and leaving feedback. Feed items carry only an external id, so we
 * lazily upsert the item via POST /api/items first, then act on the real id.
 */
import { api, ApiError } from "./api.js";
import { icon, esc, toast, openModal } from "./ui.js";

const idCache = new Map(); // external_id -> numeric db id

async function ensureItemId(item) {
  const ext = String(item.external_id || item.id || "");
  if (idCache.has(ext)) return idCache.get(ext);
  const saved = await api.upsertItem({
    external_id: ext,
    source_type: item.source_type,
    source_name: item.source_name,
    url: item.url,
    title: item.title,
    summary: item.summary,
    author: item.author,
    published_at: item.published_at,
  });
  idCache.set(ext, saved.id);
  return saved.id;
}

export async function sendFeedback(item, kind, btn) {
  try {
    if (btn) { btn.disabled = true; btn.classList.add("on"); }
    const id = await ensureItemId(item);
    await api.createFeedback(id, kind);
    toast(`Got it — we'll show ${kind === "more" ? "more like this" : kind === "less" ? "less of this" : "less of this and hide it"}.`, "success");
  } catch (err) {
    toast(err instanceof ApiError ? err.message : "Couldn't save feedback", "error");
    if (btn) { btn.disabled = false; btn.classList.remove("on"); }
  }
}

export async function openSaveModal(item) {
  let collections = [];
  try { collections = await api.collections(); }
  catch { toast("Couldn't load collections", "error"); return; }

  const { root, close } = openModal(`
    <div class="row between" style="margin-bottom:16px">
      <h3 class="h-md">Save to collection</h3>
      <button class="icon-btn" id="m-close">${icon("x")}</button>
    </div>
    <p class="muted tiny" style="margin-bottom:12px">${esc(item.title || "")}</p>
    <div class="stack" id="coll-list" style="margin-bottom:16px">
      ${collections.length
        ? collections.map((c) => `<button class="btn btn-ghost between" data-id="${c.id}">
            <span>${esc(c.name)}</span>${icon("plus")}</button>`).join("")
        : `<p class="muted tiny">No collections yet — create one below.</p>`}
    </div>
    <form id="new-coll" class="row">
      <input class="input" id="coll-name" placeholder="New collection name..." />
      <button class="btn btn-primary" type="submit">Create</button>
    </form>`);

  root.querySelector("#m-close").addEventListener("click", close);

  async function saveTo(cid) {
    try {
      const id = await ensureItemId(item);
      await api.addToCollection(cid, id);
      toast("Saved to collection", "success");
      close();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Couldn't save", "error");
    }
  }

  root.querySelectorAll("#coll-list [data-id]").forEach((b) =>
    b.addEventListener("click", () => saveTo(+b.dataset.id)));

  root.querySelector("#new-coll").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = root.querySelector("#coll-name").value.trim();
    if (!name) return;
    try {
      const c = await api.createCollection({ name });
      await saveTo(c.id);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Couldn't create collection", "error");
    }
  });
}

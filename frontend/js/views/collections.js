/** Collections: full CRUD plus viewing/removing saved items. */
import { api, ApiError } from "../api.js";
import { icon, esc, timeAgo, toast, openModal, skeletonCards, emptyState, sourceBadge } from "../ui.js";

export async function renderCollections(mount) {
  mount.innerHTML = `
    <div class="section-title between" style="display:flex">
      <h2 class="h-lg">Collections</h2>
      <button class="btn btn-primary btn-sm" id="new-coll">${icon("plus")} New collection</button>
    </div>
    <div id="coll-grid">${skeletonCards(3)}</div>`;

  mount.querySelector("#new-coll").addEventListener("click", () => createModal(mount));
  await load(mount);
}

async function load(mount) {
  const grid = mount.querySelector("#coll-grid");
  try {
    const collections = await api.collections();
    if (!collections.length) {
      grid.className = "";
      grid.innerHTML = emptyState("bookmark", "No collections yet",
        "Save stories from the dashboard, or create a collection to get started.",
        `<button class="btn btn-primary" id="empty-new">${icon("plus")} New collection</button>`);
      grid.querySelector("#empty-new").addEventListener("click", () => createModal(mount));
      return;
    }
    grid.className = "grid grid-feed";
    grid.innerHTML = collections.map((c) => `
      <article class="card interactive" data-id="${c.id}">
        <div class="row between" style="margin-bottom:8px">
          <div class="feature-ic" style="width:36px;height:36px;margin:0">${icon("bookmark")}</div>
          <div class="row" style="gap:4px">
            <button class="icon-btn btn-sm" data-act="rename" title="Rename">${icon("edit")}</button>
            <button class="icon-btn btn-sm" data-act="delete" title="Delete">${icon("trash")}</button>
          </div>
        </div>
        <h3 style="font-size:1.1rem">${esc(c.name)}</h3>
        ${c.description
          ? `<p class="muted tiny">${esc(c.description)}</p>`
          : `<button class="btn-subtle tiny" data-act="add-desc" style="padding:0">+ Add a description</button>`}
        <div class="meta tiny muted-3" style="margin-top:14px">Created ${timeAgo(c.created_at)}</div>
      </article>`).join("");

    grid.querySelectorAll("[data-id]").forEach((card) => {
      const id = +card.dataset.id;
      const c = collections.find((x) => x.id === id);
      card.addEventListener("click", (e) => {
        if (e.target.closest("[data-act]")) return;
        openCollection(mount, id);
      });
      card.querySelector('[data-act="rename"]').addEventListener("click", () => renameModal(mount, c));
      card.querySelector('[data-act="delete"]').addEventListener("click", () => deleteCollection(mount, c));
      const addDesc = card.querySelector('[data-act="add-desc"]');
      if (addDesc) addDesc.addEventListener("click", () => renameModal(mount, c));
    });
  } catch (err) {
    grid.className = "";
    grid.innerHTML = emptyState("x", "Couldn't load collections",
      err instanceof ApiError ? err.message : "Unexpected error.");
  }
}

function createModal(mount) {
  const { root, close } = openModal(`
    <div class="row between" style="margin-bottom:16px"><h3 class="h-md">New collection</h3>
      <button class="icon-btn" id="x">${icon("x")}</button></div>
    <form id="f">
      <div class="field"><label>Name</label><input class="input" id="name" placeholder="e.g. Read later" required/></div>
      <div class="field"><label>Description <span class="muted-3">(optional)</span></label>
        <input class="input" id="desc" placeholder="What's this for?"/></div>
      <button class="btn btn-primary btn-block" type="submit">Create collection</button>
    </form>`);
  root.querySelector("#x").addEventListener("click", close);
  root.querySelector("#f").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = root.querySelector("#name").value.trim();
    if (!name) return;
    try {
      await api.createCollection({ name, description: root.querySelector("#desc").value.trim() });
      toast("Collection created", "success"); close(); load(mount);
    } catch (err) { toast(err instanceof ApiError ? err.message : "Failed", "error"); }
  });
}

function renameModal(mount, c) {
  const { root, close } = openModal(`
    <div class="row between" style="margin-bottom:16px"><h3 class="h-md">Rename collection</h3>
      <button class="icon-btn" id="x">${icon("x")}</button></div>
    <form id="f">
      <div class="field"><label>Name</label><input class="input" id="name" value="${esc(c.name)}" required/></div>
      <div class="field"><label>Description</label><input class="input" id="desc" value="${esc(c.description || "")}"/></div>
      <button class="btn btn-primary btn-block" type="submit">Save changes</button>
    </form>`);
  root.querySelector("#x").addEventListener("click", close);
  root.querySelector("#f").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await api.updateCollection(c.id, {
        name: root.querySelector("#name").value.trim(),
        description: root.querySelector("#desc").value.trim(),
      });
      toast("Saved", "success"); close(); load(mount);
    } catch (err) { toast(err instanceof ApiError ? err.message : "Failed", "error"); }
  });
}

async function deleteCollection(mount, c) {
  const { root, close } = openModal(`
    <h3 class="h-md" style="margin-bottom:8px">Delete "${esc(c.name)}"?</h3>
    <p class="muted" style="margin-bottom:20px">This removes the collection and its saved-item links. This can't be undone.</p>
    <div class="row" style="justify-content:flex-end">
      <button class="btn btn-ghost" id="cancel">Cancel</button>
      <button class="btn btn-danger" id="confirm">${icon("trash")} Delete</button>
    </div>`);
  root.querySelector("#cancel").addEventListener("click", close);
  root.querySelector("#confirm").addEventListener("click", async () => {
    try { await api.deleteCollection(c.id); toast("Collection deleted", "success"); close(); load(mount); }
    catch (err) { toast(err instanceof ApiError ? err.message : "Failed", "error"); }
  });
}

async function openCollection(mount, id) {
  const { root, close } = openModal(`<div class="row between"><h3 class="h-md">Loading...</h3>
    <button class="icon-btn" id="x">${icon("x")}</button></div>`);
  root.querySelector("#x").addEventListener("click", close);
  try {
    const c = await api.getCollection(id);
    const items = c.items || [];
    root.querySelector(".modal").innerHTML = `
      <div class="row between" style="margin-bottom:6px"><h3 class="h-md">${esc(c.name)}</h3>
        <button class="icon-btn" id="x2">${icon("x")}</button></div>
      <p class="muted tiny" style="margin-bottom:16px">${esc(c.description || "")} · ${items.length} item${items.length === 1 ? "" : "s"}</p>
      <div class="stack" id="items">
        ${items.length ? items.map((it) => `
          <div class="card" data-item="${it.id}" style="padding:14px">
            <div class="row between">
              <div style="min-width:0">
                ${sourceBadge(it.source_type)}
                <div style="font-weight:600;margin-top:6px">${esc(it.title || "Untitled")}</div>
              </div>
              <button class="icon-btn btn-sm" data-rm="${it.id}" title="Remove">${icon("trash")}</button>
            </div>
            ${it.url ? `<a class="btn btn-subtle btn-sm" href="${esc(it.url)}" target="_blank" rel="noopener" style="margin-top:8px">${icon("external")} Open</a>` : ""}
          </div>`).join("")
          : `<p class="muted tiny">No items saved yet.</p>`}
      </div>`;
    root.querySelector("#x2").addEventListener("click", close);
    root.querySelectorAll("[data-rm]").forEach((b) =>
      b.addEventListener("click", async () => {
        try {
          await api.removeFromCollection(id, +b.dataset.rm);
          b.closest("[data-item]").remove();
          toast("Removed", "success");
        } catch (err) { toast(err instanceof ApiError ? err.message : "Failed", "error"); }
      }));
  } catch (err) {
    toast(err instanceof ApiError ? err.message : "Couldn't open collection", "error");
    close();
  }
}

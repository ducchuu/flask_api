/** Settings: manage interests (CRUD), tune scoring weights, account. */
import { api, ApiError } from "../api.js";
import { store } from "../store.js";
import { navigate } from "../router.js";
import { icon, esc, toast, openModal, emptyState } from "../ui.js";

const DEFAULT_WEIGHTS = { interest: 0.4, recency: 0.3, popularity: 0.2, source: 0.1 };
const DEFAULT_PREFS = { news: 0.8, video: 0.5, discussion: 0.7 };

function parse(json, fallback) {
  try { return { ...fallback, ...(JSON.parse(json || "{}")) }; } catch { return { ...fallback }; }
}

export async function renderSettings(mount) {
  mount.innerHTML = `
    <div class="section-title"><h2 class="h-lg">Settings</h2></div>
    <div class="grid grid-2">
      <div class="card" id="interests-card"><h3 class="h-md" style="margin-bottom:14px">Your interests</h3>
        <div id="interests-body"><div class="spinner"></div></div>
      </div>
      <div class="card" id="weights-card"></div>
    </div>
    <div class="card" id="account-card" style="margin-top:24px"></div>`;

  renderWeights(mount);
  renderAccount(mount);
  await renderInterests(mount);
}

/* ---- Interests CRUD ----------------------------------------------------- */
async function renderInterests(mount) {
  const body = mount.querySelector("#interests-body");
  try {
    const interests = await api.interests();
    body.innerHTML = `
      <div class="row wrap" id="int-list" style="margin-bottom:14px">
        ${interests.length
          ? interests.map((i) => `<span class="chip on">${esc(i.name)}
              <span class="x" data-edit="${i.id}" title="Edit">${icon("edit", "ic")}</span>
              <span class="x" data-del="${i.id}" title="Remove">✕</span></span>`).join("")
          : `<span class="muted tiny">No interests yet.</span>`}
      </div>
      <form id="add-int" class="row">
        <input class="input" id="int-name" placeholder="Add an interest..." />
        <button class="btn btn-ghost" type="submit" aria-label="Add interest" title="Add interest">${icon("plus")} Add</button>
      </form>`;

    body.querySelector("#add-int").addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = body.querySelector("#int-name").value.trim();
      if (!name) return;
      if (interests.length >= 10) return toast("You can follow up to 10 topics", "info");
      try {
        await api.createInterest({ name, keywords: [name.toLowerCase()], weight: 1.0 });
        toast("Interest added", "success"); renderInterests(mount);
      } catch (err) { toast(err instanceof ApiError ? err.message : "Failed", "error"); }
    });

    body.querySelectorAll("[data-del]").forEach((x) =>
      x.addEventListener("click", async () => {
        try { await api.deleteInterest(+x.dataset.del); toast("Removed", "success"); renderInterests(mount); }
        catch (err) { toast(err instanceof ApiError ? err.message : "Failed", "error"); }
      }));

    body.querySelectorAll("[data-edit]").forEach((x) =>
      x.addEventListener("click", () => editInterest(mount, interests.find((i) => i.id === +x.dataset.edit))));
  } catch (err) {
    body.innerHTML = `<p class="muted tiny">${esc(err instanceof ApiError ? err.message : "Couldn't load interests")}</p>`;
  }
}

function editInterest(mount, intr) {
  const { root, close } = openModal(`
    <div class="row between" style="margin-bottom:16px"><h3 class="h-md">Edit interest</h3>
      <button class="icon-btn" id="x">${icon("x")}</button></div>
    <form id="f">
      <div class="field"><label>Name</label><input class="input" id="name" value="${esc(intr.name)}" required/></div>
      <div class="field"><label>Weight: <span id="wv" class="mono">${intr.weight}</span></label>
        <input type="range" id="w" min="0" max="3" step="0.1" value="${intr.weight}"/></div>
      <button class="btn btn-primary btn-block" type="submit">Save</button>
    </form>`);
  root.querySelector("#x").addEventListener("click", close);
  const w = root.querySelector("#w");
  w.addEventListener("input", () => (root.querySelector("#wv").textContent = w.value));
  root.querySelector("#f").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await api.updateInterest(intr.id, {
        name: root.querySelector("#name").value.trim(),
        keywords: intr.keywords || [],
        weight: parseFloat(w.value),
      });
      toast("Interest updated", "success"); close(); renderInterests(mount);
    } catch (err) { toast(err instanceof ApiError ? err.message : "Failed", "error"); }
  });
}

/* ---- Relevance tuning (live controls) ----------------------------------- */
function renderWeights(mount) {
  const card = mount.querySelector("#weights-card");
  const weights = parse(store.user?.weights_json, DEFAULT_WEIGHTS);
  const prefs = parse(store.user?.source_prefs_json, DEFAULT_PREFS);

  const slider = (key, label, val) => `
    <div class="slider-row">
      <label>${label}</label>
      <input type="range" data-k="${key}" min="0" max="1" step="0.05" value="${val}"/>
      <span class="mono tiny" id="v-${key}">${(+val).toFixed(2)}</span>
    </div>`;

  card.innerHTML = `
    <h3 class="h-md" style="margin-bottom:4px">Ranking weights</h3>
    <p class="muted tiny" style="margin-bottom:16px">
      How much each factor counts toward a story's score (relative weights).
      <span id="wsum" class="mono"></span></p>
    ${slider("interest", "Interest match", weights.interest)}
    ${slider("recency", "Recency", weights.recency)}
    ${slider("popularity", "Popularity", weights.popularity)}
    ${slider("source", "Source type", weights.source)}
    <h4 class="tiny muted" style="text-transform:uppercase;letter-spacing:.08em;margin:18px 0 10px">Preferred sources</h4>
    <p class="muted tiny" style="margin:-4px 0 10px">How much you favour each kind of source.</p>
    ${slider("news", "News", prefs.news)}
    ${slider("video", "Video", prefs.video)}
    ${slider("discussion", "Discussion", prefs.discussion)}
    <button class="btn btn-primary btn-block" id="save-weights" style="margin-top:12px">Save & re-rank</button>`;

  const sumEl = card.querySelector("#wsum");
  const updateSum = () => {
    const total = ["interest", "recency", "popularity", "source"]
      .reduce((s, k) => s + parseFloat(card.querySelector(`[data-k="${k}"]`).value), 0);
    sumEl.textContent = `· total ${total.toFixed(2)}`;
  };
  updateSum();

  card.querySelectorAll('input[type="range"]').forEach((r) =>
    r.addEventListener("input", () => {
      card.querySelector(`#v-${r.dataset.k}`).textContent = (+r.value).toFixed(2);
      updateSum();
    }));

  card.querySelector("#save-weights").addEventListener("click", async () => {
    const read = (keys) => Object.fromEntries(keys.map((k) => [k, parseFloat(card.querySelector(`[data-k="${k}"]`).value)]));
    const newWeights = read(["interest", "recency", "popularity", "source"]);
    const newPrefs = read(["news", "video", "discussion"]);
    try {
      const res = await api.updateMe({
        weights_json: JSON.stringify(newWeights),
        source_prefs_json: JSON.stringify(newPrefs),
      });
      store.setUser(res.user || { ...store.user, weights_json: JSON.stringify(newWeights), source_prefs_json: JSON.stringify(newPrefs) });
      toast("Preferences saved — your feed will re-rank", "success");
      navigate("/dashboard");
    } catch (err) { toast(err instanceof ApiError ? err.message : "Failed", "error"); }
  });
}

/* ---- Account ------------------------------------------------------------ */
function renderAccount(mount) {
  const card = mount.querySelector("#account-card");
  card.innerHTML = `
    <h3 class="h-md" style="margin-bottom:14px">Account</h3>
    <form id="acct" class="row" style="align-items:flex-end;gap:12px;flex-wrap:wrap">
      <div class="field" style="margin:0;flex:1;min-width:200px">
        <label>Email</label><input class="input" id="email" type="email" value="${esc(store.user?.username || "")}"/>
      </div>
      <button class="btn btn-ghost" type="submit">Update email</button>
      <button class="btn btn-danger" type="button" id="logout">${icon("logout")} Sign out</button>
    </form>`;
  card.querySelector("#acct").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = card.querySelector("#email").value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast("Enter a valid email", "error"); return; }
    try {
      const res = await api.updateMe({ username: email });
      store.setUser(res.user || { ...store.user, username: email });
      toast("Email updated", "success");
    } catch (err) { toast(err instanceof ApiError ? err.message : "Failed", "error"); }
  });
  card.querySelector("#logout").addEventListener("click", () => { store.clear(); navigate("/"); });
}

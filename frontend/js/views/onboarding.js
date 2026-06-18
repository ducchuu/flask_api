/** First-run flow: pick a few interests so the feed has something to rank. */
import { api, ApiError } from "../api.js";
import { navigate } from "../router.js";
import { icon, esc, toast } from "../ui.js";

const SUGGESTIONS = [
  "Artificial Intelligence", "Climate", "Space", "Startups", "Cybersecurity",
  "Health", "Finance", "Gaming", "Science", "Politics", "Music", "Sports",
];

const MAX_TOPICS = 10;

export function renderOnboarding(mount) {
  const chosen = new Set();

  mount.innerHTML = `
  <div class="onboard">
    <div class="brand"><div class="logo">P</div><div class="name">Pulse</div></div>

    <h2 class="h-md">What do you want to follow?</h2>
    <p class="muted" style="margin-bottom:20px">
      Pick a few topics (or add your own). We'll watch them for you across news,
      video and discussion. You can change these any time.</p>

    <div class="card" style="max-width:560px;margin:0 auto">
      <div class="row wrap" id="suggestions" style="margin-bottom:16px">
        ${SUGGESTIONS.map((s) => `<button class="chip selectable" data-name="${esc(s)}">${esc(s)}</button>`).join("")}
      </div>

      <form id="custom-form" class="row" style="margin-bottom:8px">
        <input class="input" id="custom" placeholder="Add a custom topic..." />
        <button class="btn btn-ghost" type="submit" aria-label="Add topic" title="Add topic">${icon("plus")} Add</button>
      </form>

      <div class="row wrap" id="chosen" style="margin:12px 0;min-height:8px"></div>
      <div class="field-error" id="onb-error"></div>

      <button class="btn btn-primary btn-block" id="finish" disabled>Build my dashboard</button>
      <p class="tiny muted-3" id="finish-hint" style="text-align:center;margin-top:8px">Pick at least one topic to continue.</p>
      <p class="switch-line"><button id="skip">Skip for now</button></p>
    </div>
  </div>`;

  const chosenEl = mount.querySelector("#chosen");
  const finishBtn = mount.querySelector("#finish");

  function refresh() {
    chosenEl.innerHTML = [...chosen]
      .map((n) => `<span class="chip on">${esc(n)} <span class="x" data-rm="${esc(n)}">✕</span></span>`)
      .join("");
    finishBtn.disabled = chosen.size === 0;
    const hint = mount.querySelector("#finish-hint");
    if (hint) hint.style.display = chosen.size === 0 ? "block" : "none";
    mount.querySelectorAll("#suggestions .chip").forEach((c) =>
      c.classList.toggle("on", chosen.has(c.dataset.name))
    );
    chosenEl.querySelectorAll("[data-rm]").forEach((x) =>
      x.addEventListener("click", () => { chosen.delete(x.dataset.rm); refresh(); })
    );
  }

  mount.querySelectorAll("#suggestions .chip").forEach((c) =>
    c.addEventListener("click", () => {
      const name = c.dataset.name;
      if (chosen.has(name)) chosen.delete(name);
      else if (chosen.size >= MAX_TOPICS) return toast(`You can follow up to ${MAX_TOPICS} topics`, "info");
      else chosen.add(name);
      refresh();
    })
  );

  mount.querySelector("#custom-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const v = mount.querySelector("#custom").value.trim();
    if (!v) return;
    if (chosen.size >= MAX_TOPICS && !chosen.has(v)) return toast(`You can follow up to ${MAX_TOPICS} topics`, "info");
    chosen.add(v); mount.querySelector("#custom").value = ""; refresh();
  });

  mount.querySelector("#skip").addEventListener("click", () => navigate("/dashboard"));

  finishBtn.addEventListener("click", async () => {
    finishBtn.disabled = true;
    finishBtn.innerHTML = `<span class="spinner"></span> Setting up...`;
    try {
      for (const name of chosen) {
        await api.createInterest({ name, keywords: [name.toLowerCase()], weight: 1.0 });
      }
      toast("Interests saved", "success");
      navigate("/dashboard");
    } catch (err) {
      mount.querySelector("#onb-error").textContent =
        err instanceof ApiError ? err.message : "Could not save interests.";
      finishBtn.disabled = false;
      finishBtn.textContent = "Build my dashboard";
    }
  });
}

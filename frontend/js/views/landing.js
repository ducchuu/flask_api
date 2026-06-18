/** Pre-auth landing page: what Pulse is, with the pulse world map as the hero. */
import { icon } from "../ui.js";
import { pulseMapHtml } from "../pulsemap.js";

const FEATURES = [
  ["layers", "One feed, three worlds", "News, video and discussion about your topics, pulled together and de-duplicated."],
  ["sparkles", "Ranked for you", "A transparent relevance score blends interest match, recency and popularity — and you can tune it."],
  ["compass", "Stories, not links", "Items about the same event are clustered into a single story, so you see it once."],
  ["bookmark", "Keep what matters", "Save stories into named collections and pick up where you left off."],
];

export function renderLanding(mount) {
  mount.innerHTML = `
  <div class="landing">
    <nav class="landing-nav">
      <div class="brand" style="padding:0">
        <div class="logo">P</div>
        <div class="name">Pulse</div>
      </div>
      <div class="row">
        <a class="btn btn-subtle" href="#/login">Sign in</a>
        <a class="btn btn-primary" href="#/register">Get started</a>
      </div>
    </nav>

    <section class="hero-centered">
      <h1 class="h-xl">Stop checking five sites.<br/><span class="grad">Pulse watches them for you.</span></h1>
      <p class="lead">Shape a dashboard once around the topics you care about. Pulse pulls the
        latest news, video and discussion, ranks it by what matters to you, and groups the noise
        into clear stories.</p>
      <div class="row" style="justify-content:center">
        <a class="btn btn-primary" href="#/register">Create your dashboard</a>
        <a class="btn btn-ghost" href="#/login">I already have an account</a>
      </div>

      <div class="pulse-hero-lg">${pulseMapHtml()}</div>
    </section>

    <section class="features">
      <h2 class="h-lg" style="text-align:center">Built for keeping up without the grind</h2>
      <div class="features-grid">
        ${FEATURES.map(([ic, t, d]) => `
          <div class="card">
            <div class="feature-ic">${icon(ic)}</div>
            <h3 class="h-md" style="font-size:1.05rem;margin-bottom:6px">${t}</h3>
            <p class="muted">${d}</p>
          </div>`).join("")}
      </div>
    </section>
  </div>`;
}

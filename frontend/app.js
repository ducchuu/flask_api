/* Pulse, single-page frontend. Vanilla JS, hash routing, no build step.
   Surfaces every backend endpoint: auth, interests CRUD, feed query, stories,
   collections CRUD, feedback, item stats. Dark glassy grainy theme with a
   Three.js grainy-gradient 3D blob (degrades to a CSS blob without WebGL). */

'use strict';

// ---------------------------------------------------------------------------
// constants
// ---------------------------------------------------------------------------
const SOURCES = {
  news:       { label: 'News',       color: 'var(--hl-cool)', cls: 'news' },
  video:      { label: 'Video',      color: 'var(--hl)', cls: 'video' },
  discussion: { label: 'Discussion', color: 'var(--lav)',  cls: 'discussion' },
};
const DEFAULT_WEIGHTS = { interest: 0.4, recency: 0.3, popularity: 0.2, source: 0.1 };
const DEFAULT_PREFS   = { news: 0.8, video: 0.5, discussion: 0.7 };
// languages the user can pick (up to 3) to filter fetched news/video.
// codes must match SUPPORTED_LANGUAGES in backend/services/pipeline.py
const LANGS = {
  en: 'English', es: 'Spanish', fr: 'French', de: 'German', it: 'Italian', pt: 'Portuguese',
  nl: 'Dutch', ru: 'Russian', zh: 'Chinese', ja: 'Japanese', ar: 'Arabic', hi: 'Hindi',
};
const MAX_LANGS = 3;

// inline icons (no emojis anywhere in the UI)
const ICONS = {
  feed: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="5" cy="5" r="2"/><path d="M4 11a9 9 0 0 1 9 9M4 16a4 4 0 0 1 4 4"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 4h6l-1 6 3 3v2H7v-2l3-3-1-6Z"/><path d="M12 15v5"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20V4"/><path d="M4 20h16"/><rect x="7" y="11" width="3" height="6"/><rect x="13" y="7" width="3" height="10"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/></svg>',
  layers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/></svg>',
  tune: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2.2"/><circle cx="8" cy="17" r="2.2"/></svg>',
  bolt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/></svg>',
  bookmark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 4h12v16l-6-4-6 4V4Z"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>',
  up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 14 6-6 6 6"/></svg>',
  down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 10 6 6 6-6"/></svg>',
  hide: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 3l18 18M10.6 6.1A9.7 9.7 0 0 1 12 6c6 0 10 6 10 6a16 16 0 0 1-3.3 3.7M6.3 7.6A16 16 0 0 0 2 12s4 6 10 6a9.4 9.4 0 0 0 3.6-.7"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20h4L18 10l-4-4L4 16v4Z"/><path d="M14 6l4 4"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 12a9 9 0 1 1-2.6-6.3M21 4v4h-4"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>',
  cluster: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="6" cy="7" r="2.4"/><circle cx="18" cy="7" r="2.4"/><circle cx="12" cy="17" r="2.4"/><path d="M8 8.5 11 15M16 8.5 13 15"/></svg>',
  warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 3 2 20h20L12 3Z"/><path d="M12 9v5M12 17h.01"/></svg>',
  inbox: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 13l3-8h12l3 8v6H3v-6Z"/><path d="M3 13h5l1 2h6l1-2h5"/></svg>',
};
const ic = (name) => ICONS[name] || '';

const state = {
  token: localStorage.getItem('pulse_token') || null,
  user: JSON.parse(localStorage.getItem('pulse_user') || 'null'),
  feed: [],
  feedById: {},
  filters: { source: '', sort: 'relevance', query: '', days: '' },
};

const $ = (sel, root = document) => root.querySelector(sel);
const app = () => document.getElementById('app');
const authed = () => !!state.token;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function timeAgo(iso) {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (isNaN(then)) return '';
  const s = Math.max(1, Math.floor((Date.now() - then) / 1000));
  const u = [['y', 31536000], ['mo', 2592000], ['d', 86400], ['h', 3600], ['m', 60]];
  for (const [lbl, secs] of u) { if (s >= secs) return `${Math.floor(s / secs)}${lbl} ago`; }
  return `${s}s ago`;
}

let toastTimer;
function toast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = `toast show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = 'toast'; }, 3400);
}

// ---------------------------------------------------------------------------
// API client, never throws; returns {ok, status, data}
// ---------------------------------------------------------------------------
async function api(path, { method = 'GET', body } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (state.token) headers['Authorization'] = `Bearer ${state.token}`;
  let res;
  try {
    res = await fetch(`/api${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch {
    return { ok: false, status: 0, data: { error: 'Network error, is the backend running' } };
  }
  if (res.status === 401 && state.token) { clearSession(); go('#/login'); toast('Session expired, please log in', 'err'); }
  let data = null;
  const text = await res.text();
  if (text) { try { data = JSON.parse(text); } catch { data = text; } }
  return { ok: res.ok, status: res.status, data };
}
function errMsg(r, fallback = 'Something went wrong') {
  const d = r.data;
  if (d && d.error) return typeof d.error === 'string' ? d.error : (d.error.message || fallback);
  if (d && d.message) return d.message;
  return fallback;
}

// ---------------------------------------------------------------------------
// session
// ---------------------------------------------------------------------------
function setSession(token, user) {
  state.token = token; state.user = user;
  localStorage.setItem('pulse_token', token);
  localStorage.setItem('pulse_user', JSON.stringify(user));
}
function clearSession() {
  state.token = null; state.user = null;
  localStorage.removeItem('pulse_token'); localStorage.removeItem('pulse_user');
}
function userWeights() { try { return { ...DEFAULT_WEIGHTS, ...JSON.parse(state.user?.weights_json || '{}') }; } catch { return { ...DEFAULT_WEIGHTS }; } }
function userPrefs()   { try { return { ...DEFAULT_PREFS,   ...JSON.parse(state.user?.source_prefs_json || '{}') }; } catch { return { ...DEFAULT_PREFS }; } }
function userLangs()   { try { const v = JSON.parse(state.user?.languages_json || '[]'); return Array.isArray(v) ? v.filter((c) => LANGS[c]) : []; } catch { return []; } }

// ---------------------------------------------------------------------------
// router
// ---------------------------------------------------------------------------
const PROTECTED = ['dashboard', 'search', 'story', 'collections', 'insights', 'settings', 'onboarding'];
function go(hash) { if (location.hash === hash) route(); else location.hash = hash; }

function route() {
  stopBlob(); stopParallax();
  const raw = location.hash.replace(/^#\/?/, '').split('?')[0];
  const [page, ...rest] = raw.split('/');
  const name = page || (authed() ? 'dashboard' : 'landing');

  if (PROTECTED.includes(name) && !authed()) return go('#/login');
  if (name === 'landing' && authed()) return go('#/dashboard');

  window.scrollTo(0, 0);
  switch (name) {
    case 'landing':     return renderLanding();
    case 'sources':     return renderSourcesPage();
    case 'login':       return renderAuth();
    case 'onboarding':  return renderOnboarding();
    case 'dashboard':   return renderShell('dashboard', renderDashboard);
    case 'search':      return renderShell('search', renderSearch);
    case 'collections': return renderShell('collections', renderCollections);
    case 'insights':    return renderShell('insights', renderInsights);
    case 'settings':    return renderShell('settings', renderSettings);
    case 'story':       return renderShell('dashboard', () => renderStory(rest.join('/')));
    default:            return authed() ? go('#/dashboard') : go('#/');
  }
}
window.addEventListener('hashchange', route);

// ===========================================================================
// 3D grainy-gradient blob (Three.js, with CSS fallback)
// ===========================================================================
let blobAnim = null, blobCleanup = null;
function stopBlob() {
  if (blobAnim) { cancelAnimationFrame(blobAnim); blobAnim = null; }
  if (blobCleanup) { blobCleanup(); blobCleanup = null; }
}

// reveal-on-load and reveal-on-scroll for [data-reveal] elements
let revealObserver = null;
function observeReveals() {
  if (!('IntersectionObserver' in window)) { document.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('in')); return; }
  if (revealObserver) revealObserver.disconnect();
  revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); revealObserver.unobserve(e.target); } });
  }, { threshold: 0.12 });
  document.querySelectorAll('[data-reveal]:not(.in)').forEach((el) => revealObserver.observe(el));
}
// stagger reveal among a set of siblings
function stagger(root, sel, step = 90) {
  (root || document).querySelectorAll(sel).forEach((el, i) => { el.setAttribute('data-reveal', ''); el.style.transitionDelay = `${i * step}ms`; });
}

// landing parallax (background, blob, floating cards move at different rates)
let parallaxHandler = null;
function initParallax() {
  const bg = $('.landing-bg'), blob = $('.hero-canvas-wrap');
  const cards = Array.from(document.querySelectorAll('.float-card'));
  let ticking = false;
  const nav = $('.landing-nav');
  const apply = () => {
    const y = window.scrollY;
    if (bg) bg.style.transform = `translateY(${y * 0.25}px)`;
    if (blob) blob.style.transform = `translateY(${y * -0.12}px)`;
    cards.forEach((c, i) => { c.style.transform = `translateY(${y * (i % 2 ? -0.22 : 0.18)}px)`; });
    if (nav) nav.classList.toggle('scrolled', y > 24);
    ticking = false;
  };
  apply();
  parallaxHandler = () => { if (!ticking) { ticking = true; requestAnimationFrame(apply); } };
  window.addEventListener('scroll', parallaxHandler, { passive: true });
}
function stopParallax() { if (parallaxHandler) { window.removeEventListener('scroll', parallaxHandler); parallaxHandler = null; } }

// 3D clouds (mrdoob-style billboard planes) covering the entire background:
// a full-screen field of soft irregular puffs that gently hover and drift.
function initBlob(canvas) {
  const THREE = window.THREE;
  if (!THREE || !canvas) return false;
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true }); }
  catch { return false; }
  const wrap = canvas.parentElement;
  const W = () => wrap.clientWidth || 1, H = () => wrap.clientHeight || 1;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(W(), H(), false);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, W() / H(), 1, 4000);
  camera.position.z = 760;
  const halfW = () => Math.tan((camera.fov * Math.PI / 180) / 2) * camera.position.z * camera.aspect;
  const halfH = () => Math.tan((camera.fov * Math.PI / 180) / 2) * camera.position.z;

  // soft feathered puff texture, no hard edges
  const cc = document.createElement('canvas'); cc.width = cc.height = 256;
  const cx2 = cc.getContext('2d');
  const rg = cx2.createRadialGradient(128, 128, 0, 128, 128, 128);
  rg.addColorStop(0, 'rgba(255,255,255,0.85)'); rg.addColorStop(0.4, 'rgba(255,255,255,0.3)');
  rg.addColorStop(0.72, 'rgba(255,255,255,0.06)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
  cx2.fillStyle = rg; cx2.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(cc);

  const geo = new THREE.PlaneGeometry(620, 620);
  const tints = [0x000000, 0x070708, 0x101012, 0x050506, 0x0b0b0d];
  const planes = [];
  const N = 34; // soft dark smoke field
  for (let i = 0; i < N; i++) {
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false,
      opacity: 0.10 + Math.random() * 0.14, color: new THREE.Color(tints[i % tints.length]) });
    const m = new THREE.Mesh(geo, mat);
    // spread across the whole frustum (fractions of edges), varied depth
    m.userData.fx = (Math.random() - 0.5) * 2.0;   // horizontal fraction of half-width
    m.userData.fy = (Math.random() - 0.5) * 2.0;   // vertical fraction of half-height
    m.position.z = (Math.random() - 0.5) * 500;
    m.rotation.z = Math.random() * Math.PI * 2;
    const sx = 0.6 + Math.random() * 1.4, sy = sx * (0.55 + Math.random() * 0.8); // irregular puffs
    m.scale.set(sx, sy, 1);
    m.userData.ph = Math.random() * 6.28; m.userData.sp = 0.5 + Math.random();
    scene.add(m); planes.push(m);
  }

  let mx = 0, my = 0;
  const onMove = (e) => { mx = (e.clientX / window.innerWidth - 0.5) * 2; my = (e.clientY / window.innerHeight - 0.5) * 2; };
  window.addEventListener('pointermove', onMove);

  const ro = new ResizeObserver(() => { camera.aspect = W() / H(); camera.updateProjectionMatrix(); renderer.setSize(W(), H(), false); });
  ro.observe(wrap);
  blobCleanup = () => { window.removeEventListener('pointermove', onMove); ro.disconnect(); };

  const tick = () => {
    const t = performance.now() / 1000;
    const hw = halfW(), hh = halfH();
    planes.forEach((m, i) => {
      // anchor to its fraction of the viewport so the field always fills the screen,
      // then gently hover and drift; wrap horizontally so it never empties
      let drift = (m.userData.fx * hw) + Math.sin(t * 0.08 + m.userData.ph) * 40 + t * m.userData.sp * 4;
      const span = hw * 2.3;
      drift = ((drift + span / 2) % span + span) % span - span / 2;
      m.position.x = drift + mx * 26 * (m.position.z > 0 ? 1 : 0.5);
      m.position.y = m.userData.fy * hh + Math.sin(t * 0.16 + m.userData.ph) * 26 + my * 16;
      m.rotation.z += 0.0005 * (i % 2 ? 1 : -1);
    });
    renderer.render(scene, camera);
    blobAnim = requestAnimationFrame(tick);
  };
  tick();
  return true;
}

// ===========================================================================
// LANDING
// ===========================================================================
function renderLanding() {
  const features = [
    ['globe', 'Three sources, one feed', 'News, video and discussion pulled together from GNews, YouTube and forums, normalized into one clean shape.'],
    ['cluster', 'Stories, not duplicates', 'Items about the same event are clustered into a single story, so one development shows up once with every angle attached.'],
    ['tune', 'Tunable relevance', 'A transparent score you control. Slide the weights for interest, recency, popularity and source to reshape your feed live.'],
    ['search', 'Search and filter', 'Filter by source type, freshness window and free text. Sort by relevance, recency or popularity.'],
    ['bookmark', 'Save collections', 'Keep the stories you care about in named collections that reload every time you come back.'],
    ['chart', 'See the shape of it', 'Visualize your topic mix, source mix and activity over time, then click any bar to filter.'],
  ];
  const topics = ['Artificial Intelligence', 'Climate', 'Markets', 'Space', 'Web Dev', 'Health', 'Gaming', 'Startups', 'Science', 'Design', 'Crypto', 'Policy'];
  const preview = [
    ['news', 'EU agrees provisional deal on landmark AI rules'],
    ['video', 'How transformers actually work, explained'],
    ['discussion', 'What changed in robotics this month'],
  ];
  app().innerHTML = `
    <div class="landing">
      <div class="landing-bg"></div>
      <div class="cloud-layer"><canvas id="heroBlob"></canvas></div>
      ${landingNavHTML('features')}

      <header class="hero hero-split">
        <div class="hero-left">
          <h1 class="hero-title" data-reveal>${heroTitle()}</h1>
          <p class="sub" data-reveal style="transition-delay:.18s">News, video and discussion on the topics you choose, ranked by a relevance score you control and clustered into single stories.</p>
          <div class="cta-row" data-reveal style="transition-delay:.26s">
            <a class="btn primary" href="#/login?mode=register">Build my dashboard ${ic('arrow')}</a>
            <a class="btn ghost" href="#/login">I have an account</a>
          </div>
        </div>

        <div class="hero-right" data-reveal style="transition-delay:.2s">
          <div class="bento">
            <div class="tile tile-feed glass">
              <div class="tile-head"><span>Today in your feed</span><span class="live"><i></i>Live</span></div>
              ${preview.map(([t, title]) => `
                <div class="pv-row">
                  <span class="orb ${t}"></span>
                  <span class="pv-title">${title}</span>
                  <span class="badge ${t}">${SOURCES[t].label}</span>
                </div>`).join('')}
            </div>
            <div class="tile tile-mix glass">
              <div class="tile-head"><span>Source mix</span></div>
              <div class="mixbar"><span class="mb news" style="flex:5"></span><span class="mb video" style="flex:3"></span><span class="mb discussion" style="flex:2"></span></div>
              <div class="mix-legend"><span><i class="news"></i>News</span><span><i class="video"></i>Video</span><span><i class="discussion"></i>Talk</span></div>
            </div>
            <div class="tile tile-tune glass">
              <div class="tile-head"><span>Relevance</span></div>
              ${[['Interest', 78], ['Recency', 54], ['Popularity', 36]].map(([l, v]) => `
                <div class="tune-row"><label>${l}</label><div class="ttrack"><i style="width:${v}%"></i></div></div>`).join('')}
            </div>
            <div class="tile tile-cluster glass">
              <div class="cluster-num"><span class="countup" data-to="5">0</span></div>
              <div class="cluster-cap">sources clustered into one story</div>
            </div>
          </div>
        </div>
      </header>

      <div class="marquee" aria-hidden="true">
        <div class="marquee-track">
          ${[...topics, ...topics].map((t) => `<span class="mq-chip">${t}</span>`).join('')}
        </div>
      </div>

      <section class="features" id="features">
        <div class="section-head">
          <span class="label" data-reveal>What Pulse does</span>
          <h2 data-reveal style="transition-delay:.06s">Everything you follow, in one quiet place</h2>
          <p data-reveal style="transition-delay:.12s">Six ways Pulse turns scattered noise into a feed you actually keep up with.</p>
        </div>
        <div class="feature-grid">
          ${features.map(([icon, h, p], i) => `
            <div class="feature glass${i === 0 ? ' feature-wide' : ''}" data-reveal>
              <div class="feature-top"><div class="ic">${ic(icon)}</div><span class="fnum">0${i + 1}</span></div>
              <h3>${h}</h3><p>${p}</p>
            </div>`).join('')}
        </div>
      </section>

      <section class="cta-band" data-reveal>
        <h2>Stop checking. <span class="hl">Start knowing.</span></h2>
        <p>Shape your dashboard once, then let Pulse watch your corner of the world.</p>
        <a class="btn primary" href="#/login?mode=register">Build my dashboard ${ic('arrow')}</a>
      </section>
      <footer class="landing-foot">Pulse, Applied Programming for AI, Vrije Universiteit Amsterdam</footer>
    </div>`;

  // reveal + parallax run first so content is never hidden if the 3D init fails
  stagger($('.features'), '.feature', 70);
  observeReveals(); initParallax(); animateCounts();
  // 3D WebGL clouds; guarded so any failure never blanks the page
  try {
    if (!initBlob($('#heroBlob'))) { const c = $('#heroBlob'); if (c) c.style.display = 'none'; }
  } catch (e) { console.error('clouds failed', e); const c = $('#heroBlob'); if (c) c.style.display = 'none'; }
}

// count-up animation for any .countup element when it scrolls into view
function animateCounts() {
  const els = document.querySelectorAll('.countup');
  if (!('IntersectionObserver' in window)) { els.forEach((e) => { e.textContent = e.dataset.to; }); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      io.unobserve(en.target);
      const el = en.target, to = parseInt(el.dataset.to, 10) || 0, dur = 900, t0 = performance.now();
      const step = (t) => {
        const p = Math.min(1, (t - t0) / dur);
        el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }, { threshold: 0.5 });
  els.forEach((e) => io.observe(e));
}
function logoHTML() {
  return `<a class="logo" href="#/"><span class="mark"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path class="sun" d="M5 16a7 7 0 0 1 14 0Z"/>
    <line class="horizon" x1="2.5" y1="16" x2="21.5" y2="16"/>
  </svg></span>Pulse</a>`;
}
// headline split into masked words that rise into place, staggered, on load
function heroTitle() {
  const lines = [['Stop', 'checking.'], ['Start', 'knowing.']];
  let idx = 0;
  return lines.map((words, li) =>
    `<span class="line${li === 1 ? ' hl' : ''}">` +
    words.map((w) => `<span class="word" style="transition-delay:${(idx++ * 0.12).toFixed(2)}s">${w}</span>`).join(' ') +
    `</span>`).join('');
}
function landingNavHTML(active = 'features') {
  const cls = (k) => k === active ? 'class="active"' : '';
  return `
    <nav class="landing-nav">
      ${logoHTML()}
      <div class="nav-links">
        <a href="#/" ${cls('features')}>Features</a>
        <a href="#/sources" ${cls('sources')}>Sources</a>
        <a href="#/login" ${cls('dashboard')}>Dashboard</a>
      </div>
      <div class="nav-right">
        <a class="btn ghost sm" href="#/login">Log in</a>
        <a class="btn primary sm" href="#/login?mode=register">Get started</a>
      </div>
    </nav>`;
}

// short, simple public page describing the content sources / APIs
function renderSourcesPage() {
  const sources = [
    ['News', 'GNews API', 'Headlines and articles pulled from thousands of news outlets.'],
    ['Video', 'YouTube Data API v3', 'Relevant videos and channels for the topics you follow.'],
    ['Discussion', 'Lemmy API', 'Community threads and conversation from federated forums.'],
  ];
  app().innerHTML = `
    <div class="landing">
      <div class="landing-bg"></div>
      ${landingNavHTML('sources')}
      <div class="sources-page">
        <h1 data-reveal>Where Pulse gets its content</h1>
        <p class="lead" data-reveal style="transition-delay:.08s">Pulse pulls from three free, public APIs and blends them into one feed. Keys stay server-side and are never exposed to the browser.</p>
        <div class="source-list">
          ${sources.map(([label, api, desc], i) => `
            <div class="source-row glass" data-reveal style="transition-delay:${0.12 + i * 0.08}s">
              <span class="badge ${SOURCES[label.toLowerCase() === 'news' ? 'news' : label.toLowerCase() === 'video' ? 'video' : 'discussion'].cls}">${label}</span>
              <div class="src-main"><div class="src-api">${api}</div><div class="src-desc">${desc}</div></div>
            </div>`).join('')}
        </div>
        <a class="btn primary" href="#/login?mode=register" data-reveal style="transition-delay:.4s">Build my dashboard ${ic('arrow')}</a>
      </div>
      <footer class="landing-foot">Pulse, Applied Programming for AI, Vrije Universiteit Amsterdam</footer>
    </div>`;
  observeReveals();
}

// ===========================================================================
// AUTH
// ===========================================================================
function renderAuth() {
  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  let mode = params.get('mode') === 'register' ? 'register' : 'login';

  const draw = () => {
    const isReg = mode === 'register';
    app().innerHTML = `
      <div class="auth-wrap">
        <div class="auth-card glass">
          <div style="margin-bottom:24px">${logoHTML()}</div>
          <h2>${isReg ? 'Create your account' : 'Welcome back'}</h2>
          <p class="muted">${isReg ? 'Start shaping your Pulse dashboard.' : 'Log in to your dashboard.'}</p>
          <form id="authForm">
            <label class="field"><span>Username</span>
              <input type="text" name="username" autocomplete="username" required autofocus /></label>
            <label class="field"><span>Password</span>
              <input type="password" name="password" autocomplete="${isReg ? 'new-password' : 'current-password'}" required /></label>
            <button class="btn primary" style="width:100%;justify-content:center" type="submit">
              ${isReg ? 'Create account' : 'Log in'}</button>
          </form>
          <div class="auth-toggle">
            ${isReg ? 'Already have an account' : 'New to Pulse'}
            <a href="#" id="toggleMode">${isReg ? 'Log in' : 'Create one'}</a>
          </div>
        </div>
      </div>`;

    $('#toggleMode').onclick = (e) => { e.preventDefault(); mode = isReg ? 'login' : 'register'; draw(); };
    $('#authForm').onsubmit = async (e) => {
      e.preventDefault();
      const btn = $('#authForm button');
      const fd = new FormData(e.target);
      const payload = { username: fd.get('username').trim(), password: fd.get('password') };
      btn.disabled = true; btn.textContent = 'Please wait';
      const r = await api(isReg ? '/users' : '/tokens', { method: 'POST', body: payload });
      btn.disabled = false;
      if (!r.ok) { toast(errMsg(r, 'Could not authenticate'), 'err'); draw(); return; }
      setSession(r.data.token, r.data.user);
      toast(isReg ? 'Account created' : `Welcome back, ${r.data.user.username}`, 'ok');
      if (isReg) { go('#/onboarding'); return; }
      const ints = await api('/interests');
      go(ints.ok && Array.isArray(ints.data) && ints.data.length ? '#/dashboard' : '#/onboarding');
    };
  };
  draw();
}

// ===========================================================================
// ONBOARDING
// ===========================================================================
function renderOnboarding() {
  const draft = [];
  const prefs = userPrefs();

  const draw = () => {
    app().innerHTML = `
      <div class="onb">
        ${logoHTML()}
        <h1 style="margin-top:24px">What do you want Pulse to watch</h1>
        <p style="color:var(--muted)">Add a few interests. Add keywords to sharpen what gets pulled in.</p>

        <label class="field" style="margin-top:18px"><span>Add an interest</span></label>
        <div class="tag-add">
          <input type="text" id="iName" placeholder="e.g. Artificial Intelligence" />
          <input type="text" id="iKw" placeholder="keywords, comma separated" />
          <button class="btn" id="addInt">Add</button>
        </div>
        <div class="tags">
          ${draft.length ? draft.map((d, i) => `
            <span class="tag">${esc(d.name)}${d.keywords.length ? ` , <span style="color:var(--muted)">${esc(d.keywords.join(', '))}</span>` : ''}
            <button data-del="${i}" title="remove">${ic('close')}</button></span>`).join('')
            : '<span style="color:var(--muted-2)">No interests yet.</span>'}
        </div>

        <h3 style="margin-top:14px">How much of each source</h3>
        <p style="color:var(--muted);margin-top:0">Bias your feed toward the sources you trust most.</p>
        ${['news', 'video', 'discussion'].map((s) => sliderHTML(s, SOURCES[s].label, prefs[s])).join('')}

        <div style="display:flex;gap:12px;margin-top:28px">
          <button class="btn primary" id="finish">${draft.length ? 'Finish setup' : 'Skip for now'} ${ic('arrow')}</button>
          <button class="btn ghost" id="logout2">Log out</button>
        </div>
      </div>`;

    const add = () => {
      const name = $('#iName').value.trim();
      if (!name) { toast('Give the interest a name', 'err'); return; }
      const keywords = $('#iKw').value.split(',').map((s) => s.trim()).filter(Boolean);
      draft.push({ name, keywords }); draw();
    };
    $('#addInt').onclick = add;
    $('#iKw').onkeydown = (e) => { if (e.key === 'Enter') add(); };
    $('#iName').onkeydown = (e) => { if (e.key === 'Enter') $('#iKw').focus(); };
    app().querySelectorAll('[data-del]').forEach((b) => b.onclick = () => { draft.splice(+b.dataset.del, 1); draw(); });
    app().querySelectorAll('input[type=range]').forEach((r) => r.oninput = () => {
      prefs[r.dataset.key] = +r.value; r.closest('.slider-row').querySelector('.pct').textContent = `${Math.round(r.value * 100)}%`;
    });
    $('#logout2').onclick = () => { clearSession(); go('#/'); };
    $('#finish').onclick = async () => {
      for (const d of draft) await api('/interests', { method: 'POST', body: { name: d.name, keywords: d.keywords, weight: 1.0 } });
      await api('/users/me', { method: 'PATCH', body: { source_prefs_json: JSON.stringify(prefs) } });
      const me = await api('/users/me'); if (me.ok) { state.user = me.data.user; localStorage.setItem('pulse_user', JSON.stringify(state.user)); }
      toast('All set, building your feed', 'ok'); go('#/dashboard');
    };
  };
  draw();
}
function sliderHTML(key, label, val) {
  return `<div class="slider-row">
    <label>${label}</label>
    <input type="range" min="0" max="1" step="0.05" value="${val}" data-key="${key}" />
    <span class="pct">${Math.round(val * 100)}%</span>
  </div>`;
}

function prettyDate(s) {
  const m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const [y, mo, d] = String(s || '').slice(0, 10).split('-');
  return (d && mo && y) ? `${+d} ${m[+mo - 1]} ${y}` : '—';
}

// ---- radar / spider chart, pure SVG, no deps. values are 0..1 ----
const RADAR = { cx: 120, cy: 120, r: 84 };
function radarPoints(vals) {
  const n = vals.length;
  return vals.map((v, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    const rr = RADAR.r * Math.max(0.04, Math.min(1, v));
    return [RADAR.cx + rr * Math.cos(a), RADAR.cy + rr * Math.sin(a)];
  });
}
function radarSVG(items, id) {
  const n = items.length, { cx, cy, r } = RADAR;
  const tip = (i, rad) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / n; return [cx + rad * Math.cos(a), cy + rad * Math.sin(a)]; };
  const fmt = (p) => p.map((x) => x.toFixed(1)).join(',');
  const rings = [0.25, 0.5, 0.75, 1].map((f) =>
    `<polygon class="radar-ring" points="${items.map((_, i) => fmt(tip(i, r * f))).join(' ')}" />`).join('');
  const axes = items.map((_, i) => { const [x, y] = tip(i, r); return `<line class="radar-axis" x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" />`; }).join('');
  const labels = items.map((it, i) => {
    const [x, y] = tip(i, r + 17);
    const anchor = Math.abs(x - cx) < 6 ? 'middle' : (x > cx ? 'start' : 'end');
    return `<text class="radar-lbl" x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="${anchor}">${it.label}</text>`;
  }).join('');
  const pts = radarPoints(items.map((it) => it.value));
  const dots = pts.map((p) => `<circle class="radar-dot" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3.5" />`).join('');
  return `<svg id="${id}" class="radar" viewBox="0 0 240 240">
    ${rings}${axes}
    <polygon class="radar-area" points="${pts.map(fmt).join(' ')}" />
    <g class="radar-dots">${dots}</g>${labels}
  </svg>`;
}
function updateRadar(svg, vals) {
  if (!svg) return;
  const pts = radarPoints(vals);
  svg.querySelector('.radar-area').setAttribute('points', pts.map((p) => p.map((x) => x.toFixed(1)).join(',')).join(' '));
  svg.querySelectorAll('.radar-dot').forEach((d, i) => { if (pts[i]) { d.setAttribute('cx', pts[i][0].toFixed(1)); d.setAttribute('cy', pts[i][1].toFixed(1)); } });
}

// ===========================================================================
// SHELL
// ===========================================================================
function renderShell(active, pageFn) {
  const nav = [
    ['dashboard', 'feed', 'Dashboard', '#/dashboard'],
    ['search', 'search', 'Search', '#/search'],
    ['collections', 'pin', 'Collections', '#/collections'],
    ['insights', 'chart', 'Insights', '#/insights'],
    ['settings', 'gear', 'Settings', '#/settings'],
  ];
  const initial = (state.user?.username || '?')[0].toUpperCase();
  app().innerHTML = `
    <div class="shell">
      <aside class="sidebar">
        ${logoHTML()}
        ${nav.map(([id, icon, txt, href]) => `
          <a class="nav-item ${id === active ? 'active' : ''}" href="${href}">
            ${ic(icon)}<span class="txt">${txt}</span></a>`).join('')}
        <div class="spacer"></div>
        <div class="user-pill">
          <div class="avatar">${initial}</div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:600;font-size:13px;overflow:hidden;text-overflow:ellipsis">${esc(state.user?.username || '')}</div>
            <a href="#" id="logout" style="font-size:12px;color:var(--muted)">Log out</a>
          </div>
        </div>
      </aside>
      <main class="main"><div class="content" id="page"></div></main>
      <button class="mobile-logout" id="mLogout">Log out</button>
    </div>`;
  const doLogout = (e) => { e.preventDefault(); clearSession(); toast('Logged out'); go('#/'); };
  $('#logout').onclick = doLogout;
  $('#mLogout').onclick = doLogout;
  pageFn();
}

// ===========================================================================
// filter bar + feed loading
// ===========================================================================
function filterBarHTML(f, withSearch) {
  return `
    <div class="filterbar glass">
      ${withSearch ? `<input class="grow" type="search" id="fQuery" placeholder="Search news, video and discussion" value="${esc(f.query)}" />` : '<div class="grow" style="font-size:13px;color:var(--muted)">Showing your followed interests</div>'}
      <div class="seg" id="fSource">
        ${[['', 'All'], ['news', 'News'], ['video', 'Video'], ['discussion', 'Discussion']]
          .map(([v, l]) => `<button data-v="${v}" class="${f.source === v ? 'active' : ''}">${l}</button>`).join('')}
      </div>
      <select id="fSort" title="Sort order">
        ${[['relevance', 'Most relevant'], ['recency', 'Most recent'], ['popularity', 'Most popular']]
          .map(([v, l]) => `<option value="${v}" ${f.sort === v ? 'selected' : ''}>${l}</option>`).join('')}
      </select>
      <select id="fDays" title="Freshness window">
        ${[['', 'Any time'], ['1', 'Past day'], ['7', 'Past week'], ['30', 'Past month']]
          .map(([v, l]) => `<option value="${v}" ${String(f.days) === v ? 'selected' : ''}>${l}</option>`).join('')}
      </select>
      <button class="btn sm" id="fApply">Apply</button>
    </div>`;
}
function wireFilterBar(onChange) {
  const seg = $('#fSource');
  if (seg) seg.querySelectorAll('button').forEach((b) => b.onclick = () => {
    seg.querySelectorAll('button').forEach((x) => x.classList.remove('active'));
    b.classList.add('active'); state.filters.source = b.dataset.v; onChange();
  });
  if ($('#fSort')) $('#fSort').onchange = (e) => { state.filters.sort = e.target.value; onChange(); };
  if ($('#fDays')) $('#fDays').onchange = (e) => { state.filters.days = e.target.value; onChange(); };
  if ($('#fApply')) $('#fApply').onclick = () => { if ($('#fQuery')) state.filters.query = $('#fQuery').value.trim(); onChange(); };
  if ($('#fQuery')) $('#fQuery').onkeydown = (e) => { if (e.key === 'Enter') { state.filters.query = e.target.value.trim(); onChange(); } };
}

async function loadFeed() {
  const f = state.filters;
  const qs = new URLSearchParams();
  if (f.source) qs.set('source', f.source);
  if (f.sort) qs.set('sort', f.sort);
  if (f.query) qs.set('query', f.query);
  if (f.days) qs.set('days', f.days);
  const r = await api(`/items?${qs.toString()}`);
  if (!r.ok) return { ok: false, msg: errMsg(r, 'Could not load feed') };
  const stories = (Array.isArray(r.data) ? r.data : []).map(normalizeStory);
  state.feed = stories; state.feedById = {};
  stories.forEach((s) => { state.feedById[s.id] = s; });
  return { ok: true, stories };
}
function normalizeStory(s) {
  const items = (s.items || []).map(normalizeItem);
  const title = s.title || bestTitle(items) || (s.keywords || []).slice(0, 4).join(', ') || 'Untitled story';
  return { id: String(s.id), title, keywords: s.keywords || [], items, item_count: s.item_count ?? items.length };
}
function normalizeItem(it) {
  return {
    id: it.id, source_type: it.source_type || 'news', source_name: it.source_name || '',
    url: it.url, title: it.title || 'untitled', summary: it.summary || '',
    author: it.author, published_at: it.published_at,
    read_time: it.read_time ?? it.read_time_min, sentiment: it.sentiment || it.sentiment_label || 'neutral',
    credibility: it.credibility || it.credibility_tier || 'unknown',
    relevance: it.relevance_score, keywords: it.keywords || [], metrics: it.metrics || {},
    // honour an explicit image field if the API ever provides one
    image: it.image || it.image_url || it.thumbnail || it.urlToImage || null,
  };
}

// derive a preview image without backend changes:
//  - video: real YouTube thumbnail from the video id
//  - otherwise: the site favicon, on a tinted gradient placeholder
function thumbSrc(it) {
  if (it.image) return { kind: 'cover', src: it.image };
  const id = ytId(it);
  if (it.source_type === 'video' && id) return { kind: 'cover', src: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` };
  if (it.url) { try { return { kind: 'fav', src: `https://www.google.com/s2/favicons?domain=${new URL(it.url).hostname}&sz=128` }; } catch {} }
  return null;
}
function ytId(it) {
  if (it.source_type !== 'video') return null;
  if (it.url) { const m = String(it.url).match(/[?&]v=([\w-]{6,})/); if (m) return m[1]; }
  return /^[\w-]{6,}$/.test(String(it.id)) ? it.id : null;
}
function itemThumb(it, big) {
  const cls = SOURCES[it.source_type]?.cls || 'ghost';
  const t = thumbSrc(it);
  const sz = big ? 'thumb lg' : 'thumb';
  if (!t) return `<div class="${sz} ${cls} noimg"></div>`;
  if (t.kind === 'fav') return `<div class="${sz} ${cls} fav noimg"><img src="${esc(t.src)}" loading="lazy" alt="" onerror="this.remove()"/></div>`;
  return `<div class="${sz} ${cls}"><img src="${esc(t.src)}" loading="lazy" alt="" onerror="this.parentElement.classList.add('noimg');this.remove()"/></div>`;
}
function bestTitle(items) { const news = items.find((i) => i.source_type === 'news'); return (news || items[0])?.title; }

// ===========================================================================
// DASHBOARD
// ===========================================================================
async function renderDashboard() {
  const p = $('#page');
  p.innerHTML = `
    <div class="page-head"><div><h1>Your feed</h1><p>Ranked by your tuned relevance score, clustered into stories.</p></div></div>
    ${filterBarHTML(state.filters, false)}
    <div id="feed">${skeletons(3)}</div>`;
  wireFilterBar(() => renderDashboard());
  const r = await loadFeed();
  if (!r.ok) { $('#feed').innerHTML = stateBox('warn', 'Could not load your feed', r.msg); return; }
  if (!r.stories.length) {
    $('#feed').innerHTML = stateBox('globe', 'Nothing here yet', 'Add interests in onboarding or try Search for a topic.', `<a class="btn primary" href="#/search">Go to Search</a>`);
    return;
  }
  $('#feed').innerHTML = feedStatsHTML(r.stories) + `<div class="grid-stories">${r.stories.map((s, i) => storyCardHTML(s, i)).join('')}</div>`;
  observeReveals(); animateCounts(); animateRings(); wireSpotlight();
}

// ===========================================================================
// SEARCH
// ===========================================================================
async function renderSearch() {
  const p = $('#page');
  p.innerHTML = `
    <div class="page-head"><div><h1>Search</h1><p>Filter by source, freshness and sort. Search overrides your interests.</p></div></div>
    ${filterBarHTML(state.filters, true)}
    <div id="feed">${state.filters.query ? skeletons(3) : stateBox('search', 'Search across your sources', 'Type a topic and press enter.')}</div>`;
  wireFilterBar(() => renderSearch());
  if (!state.filters.query && !state.filters.source) return;
  $('#feed').innerHTML = skeletons(3);
  const r = await loadFeed();
  if (!r.ok) { $('#feed').innerHTML = stateBox('warn', 'Search failed', r.msg); return; }
  if (!r.stories.length) { $('#feed').innerHTML = stateBox('search', 'No results', 'Try a broader query or a wider freshness window.'); return; }
  $('#feed').innerHTML = `<div class="grid-stories">${r.stories.map((s, i) => storyCardHTML(s, i)).join('')}</div>`;
  observeReveals(); animateRings(); wireSpotlight();
}

function storyCardHTML(s, idx = 0) {
  const present = [...new Set(s.items.map((i) => i.source_type))];
  const topRel = Math.max(0, ...s.items.map((it) => +it.relevance || 0));
  return `
    <article class="story-card glass" data-reveal style="transition-delay:${(idx * 0.06).toFixed(2)}s">
      <div class="story-top">
        <div style="min-width:0">
          <h3 data-action="open-story" data-id="${esc(s.id)}">${esc(s.title)}</h3>
          <div class="badges">
            ${present.map((t) => `<span class="badge ${SOURCES[t]?.cls || 'ghost'}">${SOURCES[t]?.label || t}</span>`).join('')}
            <span class="story-meta">${s.items.length} source${s.items.length > 1 ? 's' : ''}</span>
          </div>
        </div>
        <div class="story-top-right">
          ${relRing(topRel)}
          <button class="btn sm ghost" data-action="open-story" data-id="${esc(s.id)}">Open ${ic('arrow')}</button>
        </div>
      </div>
      <div class="story-items">
        ${s.items.slice(0, 4).map(itemRowHTML).join('')}
        ${s.items.length > 4 ? `<button class="btn sm ghost" style="align-self:flex-start;margin-top:6px" data-action="open-story" data-id="${esc(s.id)}">${ic('plus')} ${s.items.length - 4} more</button>` : ''}
      </div>
    </article>`;
}
function itemRowHTML(it) {
  const cls = SOURCES[it.source_type]?.cls || 'ghost';
  const meta = [
    it.source_name && esc(it.source_name),
    it.published_at && timeAgo(it.published_at),
    it.read_time != null && `${it.read_time} min`,
    it.credibility && it.credibility !== 'unknown' && `cred ${esc(it.credibility)}`,
    it.relevance != null && `score ${(+it.relevance).toFixed(2)}`,
  ].filter(Boolean);
  return `
    <div class="item-row">
      ${itemThumb(it, false)}
      <div class="item-main">
        ${it.url ? `<a class="title" href="${esc(it.url)}" target="_blank" rel="noopener">${esc(it.title)}</a>`
                 : `<span class="title">${esc(it.title)}</span>`}
        <div class="item-sub">
          <span class="badge ${cls}">${SOURCES[it.source_type]?.label || it.source_type}</span>
          <span class="senti ${esc(it.sentiment)}">${esc(it.sentiment)}</span>
          ${meta.map((m) => `<span>${m}</span>`).join('')}
        </div>
      </div>
      ${itemActionsHTML(it.id)}
    </div>`;
}
function itemActionsHTML(id) {
  return `<div class="item-actions">
    <button class="iaction" title="More like this" data-action="fb" data-kind="more" data-item="${esc(id)}">${ic('up')}</button>
    <button class="iaction" title="Less like this" data-action="fb" data-kind="less" data-item="${esc(id)}">${ic('down')}</button>
    <button class="iaction" title="Hide" data-action="fb" data-kind="hide" data-item="${esc(id)}">${ic('hide')}</button>
    <button class="iaction" title="Save to collection" data-action="save" data-item="${esc(id)}">${ic('plus')}</button>
  </div>`;
}

// circular relevance gauge (0..1). animates in via animateRings()
function relRing(score) {
  const pct = Math.max(0, Math.min(1, score || 0));
  const R = 17, C = 2 * Math.PI * R;
  return `<div class="rel-ring" title="Top relevance ${Math.round(pct * 100)}%">
    <svg viewBox="0 0 42 42">
      <circle class="rr-bg" cx="21" cy="21" r="${R}"/>
      <circle class="rr-fg" cx="21" cy="21" r="${R}" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${C.toFixed(1)}" data-off="${(C * (1 - pct)).toFixed(1)}"/>
    </svg>
    <span class="rr-val">${Math.round(pct * 100)}</span>
  </div>`;
}
function animateRings() {
  requestAnimationFrame(() => document.querySelectorAll('.rr-fg').forEach((c) => { c.style.strokeDashoffset = c.dataset.off; }));
}

// at-a-glance stat strip computed from the loaded stories (no backend call)
function feedStatsHTML(stories) {
  const items = stories.flatMap((s) => s.items);
  const rels = items.map((i) => +i.relevance).filter((x) => !isNaN(x));
  const avg = rels.length ? Math.round(rels.reduce((a, b) => a + b, 0) / rels.length * 100) : 0;
  const mix = {}; items.forEach((i) => { mix[i.source_type] = (mix[i.source_type] || 0) + 1; });
  return `<div class="feed-stats">
    <div class="fstat"><div class="fstat-n"><span class="countup" data-to="${stories.length}">0</span></div><div class="fstat-l">Stories</div></div>
    <div class="fstat"><div class="fstat-n"><span class="countup" data-to="${items.length}">0</span></div><div class="fstat-l">Sources</div></div>
    <div class="fstat"><div class="fstat-n"><span class="countup" data-to="${avg}">0</span><span class="fstat-u">%</span></div><div class="fstat-l">Avg relevance</div></div>
    <div class="fstat fstat-mix">
      <div class="fstat-l" style="margin-bottom:8px">Source mix</div>
      <div class="mixbar">${['news', 'video', 'discussion'].map((t) => mix[t] ? `<span class="mb ${t}" style="flex:${mix[t]}"></span>` : '').join('')}</div>
      <div class="mix-legend" style="margin-top:8px">${['news', 'video', 'discussion'].filter((t) => mix[t]).map((t) => `<span><i class="${t}"></i>${SOURCES[t].label} ${mix[t]}</span>`).join('')}</div>
    </div>
  </div>`;
}

// amber spotlight that follows the cursor across the feed cards
function wireSpotlight() {
  const grid = $('#feed');
  if (!grid) return;
  grid.addEventListener('pointermove', (e) => {
    const card = e.target.closest('.story-card');
    if (!card) return;
    const r = card.getBoundingClientRect();
    card.style.setProperty('--mx', `${e.clientX - r.left}px`);
    card.style.setProperty('--my', `${e.clientY - r.top}px`);
  });
}

// ===========================================================================
// STORY DETAIL
// ===========================================================================
async function renderStory(id) {
  const p = $('#page');
  let story = state.feedById[id];
  if (!story && /^\d+$/.test(id)) {
    p.innerHTML = `<div class="loading"><div class="spinner"></div>Loading story</div>`;
    const r = await api(`/stories/${id}`);
    if (r.ok) story = normalizeStory(r.data);
  }
  if (!story) { p.innerHTML = stateBox('search', 'Story not found', 'It may have scrolled out of your feed.', `<a class="btn" href="#/dashboard">Back to feed</a>`); return; }

  const present = [...new Set(story.items.map((i) => i.source_type))];
  p.innerHTML = `
    <a class="btn sm ghost" href="#/dashboard" style="margin-bottom:18px">Back</a>
    <div class="page-head"><div>
      <h1>${esc(story.title)}</h1>
      <div class="badges" style="margin-top:10px">
        ${present.map((t) => `<span class="badge ${SOURCES[t]?.cls || 'ghost'}">${SOURCES[t]?.label || t}</span>`).join('')}
        <span class="story-meta">${story.items.length} clustered source${story.items.length > 1 ? 's' : ''}</span>
      </div>
      ${story.keywords?.length ? `<div class="badges" style="margin-top:10px">${story.keywords.slice(0, 8).map((k) => `<span class="badge ghost">${esc(k)}</span>`).join('')}</div>` : ''}
    </div></div>
    <div class="grid-stories">
      ${story.items.map((it) => `
        <article class="story-card glass" data-reveal>
          ${itemThumb(it, true)}
          <div class="badges" style="margin:12px 0 8px"><span class="badge ${SOURCES[it.source_type]?.cls || 'ghost'}">${SOURCES[it.source_type]?.label || it.source_type}</span>
            <span class="story-meta">${esc(it.source_name || '')} ${it.published_at ? ', ' + timeAgo(it.published_at) : ''}</span></div>
          ${it.url ? `<a class="title" style="font-size:19px;font-weight:700" href="${esc(it.url)}" target="_blank" rel="noopener">${esc(it.title)}</a>`
                   : `<h3>${esc(it.title)}</h3>`}
          <p style="color:var(--muted);font-size:14px">${esc(it.summary || 'No summary available.')}</p>
          <div class="item-sub">
            <span class="senti ${esc(it.sentiment)}">${esc(it.sentiment)}</span>
            ${it.read_time != null ? `<span>${it.read_time} min</span>` : ''}
            ${it.author ? `<span>by ${esc(it.author)}</span>` : ''}
            ${it.relevance != null ? `<span>score ${(+it.relevance).toFixed(2)}</span>` : ''}
          </div>
          <div style="margin-top:12px">${itemActionsHTML(it.id)}</div>
        </article>`).join('')}
    </div>`;
  observeReveals();
}

// ===========================================================================
// COLLECTIONS
// ===========================================================================
async function renderCollections() {
  const p = $('#page');
  p.innerHTML = `
    <div class="page-head">
      <div><h1>Collections</h1><p>Named buckets of saved stories. They reload every visit.</p></div>
      <button class="btn primary" data-action="new-collection">${ic('plus')} New collection</button>
    </div>
    <div id="colls">${skeletons(2)}</div>`;
  const r = await api('/collections');
  if (!r.ok) { $('#colls').innerHTML = stateBox('warn', 'Could not load collections', errMsg(r)); return; }
  const colls = r.data || [];
  if (!colls.length) { $('#colls').innerHTML = stateBox('inbox', 'No collections yet', 'Create one, then save items to it from your feed.'); return; }
  const full = await Promise.all(colls.map((c) => api(`/collections/${c.id}`)));
  $('#colls').innerHTML = `<div class="card-grid">${colls.map((c, i) => {
    const items = (full[i].ok && full[i].data.items) || [];
    return `
      <div class="coll-card glass">
        <h3>${esc(c.name)}</h3>
        <div class="desc">${esc(c.description || 'No description')}</div>
        <div class="story-meta">${items.length} item${items.length !== 1 ? 's' : ''}</div>
        ${items.slice(0, 3).map((it) => `<div class="item-sub" style="margin-top:4px"><span class="orb ${SOURCES[it.source_type]?.cls || 'ghost'}" style="position:relative;top:4px"></span> ${esc(it.title)}</div>`).join('')}
        <div class="row">
          <button class="btn sm" data-action="view-collection" data-id="${c.id}">Open</button>
          <button class="btn sm ghost" data-action="edit-collection" data-id="${c.id}" data-name="${esc(c.name)}" data-desc="${esc(c.description || '')}">Rename</button>
          <button class="btn sm ghost" data-action="del-collection" data-id="${c.id}" data-name="${esc(c.name)}">Delete</button>
        </div>
      </div>`;
  }).join('')}</div>`;
}

async function viewCollection(id) {
  const r = await api(`/collections/${id}`);
  if (!r.ok) { toast(errMsg(r), 'err'); return; }
  const c = r.data; const items = c.items || [];
  modal(`
    <h3>${esc(c.name)}</h3>
    <p style="color:var(--muted);margin-top:0">${esc(c.description || '')} <span class="hint">· ${items.length} saved</span></p>
    ${items.length ? `<div class="coll-list">${items.map((it) => collItemHTML(it, id)).join('')}</div>`
      : '<p style="color:var(--muted)">No items saved here yet.</p>'}
    <div class="row"><button class="btn" data-action="close-modal">Close</button></div>`);
}

// one saved item: thumbnail + title that links out to the original, plus remove
function collItemHTML(it, collId) {
  const cls = SOURCES[it.source_type]?.cls || 'ghost';
  const label = SOURCES[it.source_type]?.label || it.source_type;
  let host = '';
  if (it.url) { try { host = new URL(it.url).hostname.replace(/^www\./, ''); } catch {} }
  const inner = `
    ${itemThumb(it, false)}
    <div class="coll-item-main">
      <div class="coll-item-title">${esc(it.title)}</div>
      <div class="story-meta"><span class="badge ${cls}">${label}</span>${host ? `<span class="coll-host">${esc(host)}</span>` : ''}</div>
    </div>
    ${it.url ? `<span class="coll-go" title="Open">${ic('arrow')}</span>` : ''}`;
  const body = it.url
    ? `<a class="coll-item-link" href="${esc(it.url)}" target="_blank" rel="noopener">${inner}</a>`
    : `<div class="coll-item-link">${inner}</div>`;
  return `<div class="coll-item">
    ${body}
    <button class="btn sm ghost" data-action="rm-coll-item" data-coll="${collId}" data-item="${it.id}">Remove</button>
  </div>`;
}

// ===========================================================================
// INSIGHTS
// ===========================================================================
async function renderInsights() {
  const p = $('#page');
  p.innerHTML = `
    <div class="page-head">
      <div><h1>Insights</h1><p>The shape of your feed. Click any source bar to filter your search.</p></div>
      <button class="btn ghost" data-action="ingest" title="Run the ingestion pipeline">${ic('refresh')} Ingest sources</button>
    </div>
    <div id="ins">${skeletons(2)}</div>`;

  const r = await loadFeed();
  if (!r.ok) { $('#ins').innerHTML = stateBox('warn', 'Could not load data', r.msg); return; }
  const stories = r.stories;
  const items = stories.flatMap((s) => s.items);

  const [bySrc, byInt, byDay] = await Promise.all([
    api('/items/stats?by=source_type'), api('/items/stats?by=interest'), api('/items/stats?by=day'),
  ]);
  const srcData = pickStats(bySrc, 'source_type') || aggCount(items, (i) => i.source_type);
  const dayData = pickStats(byDay, 'day', true) || aggByDay(items);
  const intData = pickStats(byInt, 'interest') || aggKeywords(items);

  const avgRel = items.length ? (items.reduce((a, i) => a + (+i.relevance || 0), 0) / items.length) : 0;
  const kpis = [
    [stories.length, 'Stories'], [items.length, 'Items'],
    [Object.keys(srcData).length, 'Source types'], [avgRel.toFixed(2), 'Avg relevance'],
  ];

  $('#ins').innerHTML = `
    <div class="kpis">${kpis.map(([n, l]) => `<div class="kpi glass" data-reveal><div class="n">${n}</div><div class="l">${l}</div></div>`).join('')}</div>
    <div class="chart-card glass" data-reveal>
      <h3>Source mix</h3><p class="hint">How your feed splits across news, video and discussion. Click to filter.</p>
      ${barsHTML(srcData, (k) => SOURCES[k]?.color || 'var(--muted)', true)}
    </div>
    <div class="chart-card glass" data-reveal>
      <h3>Topic mix</h3><p class="hint">Most frequent keywords across your current feed.</p>
      ${barsHTML(intData, () => 'linear-gradient(90deg, var(--hl-cool), var(--hl))', false)}
    </div>
    <div class="chart-card glass" data-reveal>
      <h3>Activity over time</h3><p class="hint">Items published per day.</p>
      ${sparkHTML(dayData)}
    </div>`;
  app().querySelectorAll('[data-filter-source]').forEach((b) => b.onclick = () => {
    state.filters.source = b.dataset.filterSource; state.filters.query = ''; go('#/search');
  });
  wireSpark();
  observeReveals();
}
function pickStats(r, key, isDay) {
  if (!r.ok || !r.data || !Array.isArray(r.data.stats) || !r.data.stats.length) return null;
  const out = {};
  for (const row of r.data.stats) {
    const label = isDay ? row.day : (row[key] || row.interest || row.source_type);
    out[label] = row.count;
  }
  return Object.keys(out).length ? out : null;
}
function aggCount(items, fn) { const m = {}; items.forEach((i) => { const k = fn(i) || 'other'; m[k] = (m[k] || 0) + 1; }); return m; }
function aggByDay(items) { const m = {}; items.forEach((i) => { if (i.published_at) { const d = i.published_at.slice(0, 10); m[d] = (m[d] || 0) + 1; } }); return m; }
function aggKeywords(items) {
  const m = {}; items.forEach((i) => (i.keywords || []).forEach((k) => { m[k] = (m[k] || 0) + 1; }));
  return Object.fromEntries(Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 8));
}
function barsHTML(data, colorFn, asFilter) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return '<p style="color:var(--muted)">No data yet.</p>';
  const max = Math.max(...entries.map((e) => e[1]), 1);
  return entries.map(([k, v]) => `
    <div class="bar-row" ${asFilter && SOURCES[k] ? `data-filter-source="${k}"` : ''}>
      <span class="lbl">${esc(k)}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${(v / max) * 100}%;background:${colorFn(k)}"></div></div>
      <span class="val">${v}</span>
    </div>`).join('');
}
// activity trend: scroll to zoom, drag to pan over the time window, double-click to reset
let _spark = { entries: [], lo: 0, hi: 0 };
function sparkHTML(data) {
  const entries = Object.entries(data).sort((a, b) => a[0].localeCompare(b[0]));
  if (entries.length < 2) return '<p style="color:var(--muted)">Not enough dated items to chart a trend yet.</p>';
  _spark = { entries, lo: 0, hi: entries.length - 1 };
  return `<div class="spark-wrap">
    <div class="spark-tip" id="sparkTip"></div>
    <div class="spark-yaxis" id="sparkY"></div>
    <svg class="spark" id="spark" viewBox="0 0 720 160" preserveAspectRatio="none" aria-label="Items published per day"></svg>
    <div class="spark-xaxis" id="sparkX"></div>
    <div class="spark-x"><span class="spark-hint">hover for values · scroll to zoom · drag to pan · double-click to reset</span></div>
  </div>`;
}
function drawSpark() {
  const svg = $('#spark'); if (!svg) return;
  const { entries, lo, hi } = _spark;
  const win = entries.slice(lo, hi + 1);
  // padL/padB leave room for the y-axis counts and x-axis dates
  const w = 720, h = 160, padL = 36, padR = 14, padT = 14, padB = 18, n = win.length;
  const max = Math.max(...win.map((e) => e[1]), 1);
  const x = (i) => n <= 1 ? (padL + w - padR) / 2 : padL + (i * (w - padL - padR)) / (n - 1);
  const y = (v) => h - padB - (v / max) * (h - padT - padB);
  // stash for the hover handler so it maps the cursor back to a data point
  _spark.win = win; _spark.x = x; _spark.y = y; _spark.w = w; _spark.h = h;
  const pts = win.map((e, i) => `${x(i).toFixed(1)},${y(e[1]).toFixed(1)}`).join(' ');
  const area = `${x(0).toFixed(1)},${h - padB} ${pts} ${x(n - 1).toFixed(1)},${h - padB}`;

  // y-axis: 0 / mid / max horizontal gridlines (deduped for tiny ranges)
  const yticks = [...new Set([0, Math.round(max / 2), max])];
  const grid = yticks.map((t) =>
    `<line class="spark-grid-line" x1="${padL}" x2="${w - padR}" y1="${y(t).toFixed(1)}" y2="${y(t).toFixed(1)}" vector-effect="non-scaling-stroke"></line>`
  ).join('');

  svg.innerHTML = `
    <defs>
      <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="rgba(231,199,154,0.55)"/>
        <stop offset="0.5" stop-color="rgba(234,164,106,0.16)"/>
        <stop offset="1" stop-color="rgba(234,164,106,0)"/>
      </linearGradient>
      <linearGradient id="slg" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="var(--hl-cool)"/><stop offset="1" stop-color="var(--hl)"/>
      </linearGradient>
      <filter id="sglow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="3" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
    ${grid}
    <polygon points="${area}" fill="url(#sg)"></polygon>
    <polyline points="${pts}" fill="none" stroke="url(#slg)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" filter="url(#sglow)"></polyline>
    ${win.map((e, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(e[1]).toFixed(1)}" r="3" fill="var(--hl)" stroke="#0c0d10" stroke-width="1" vector-effect="non-scaling-stroke"></circle>`).join('')}
    <line id="sparkGuide" y1="${padT}" y2="${h - padB}" stroke="var(--hl-cool)" stroke-width="1" stroke-dasharray="3 3" vector-effect="non-scaling-stroke" opacity="0"></line>
    <circle id="sparkDot" r="5" fill="var(--hl)" stroke="#0c0d10" stroke-width="1.5" vector-effect="non-scaling-stroke" opacity="0"></circle>`;

  // axis labels live in HTML so preserveAspectRatio="none" doesn't stretch the text
  $('#sparkY').innerHTML = yticks.map((t) =>
    `<span style="top:${(y(t) / h * 100).toFixed(2)}%">${t}</span>`).join('');
  const step = Math.max(1, Math.ceil((n - 1) / 5));
  let xs = '';
  for (let i = 0; i < n; i += step) {
    xs += `<span style="left:${(x(i) / w * 100).toFixed(2)}%">${win[i][0].slice(5)}</span>`;
  }
  if ((n - 1) % step !== 0) {  // make sure the latest day is always labelled
    xs += `<span style="left:${(x(n - 1) / w * 100).toFixed(2)}%">${win[n - 1][0].slice(5)}</span>`;
  }
  $('#sparkX').innerHTML = xs;
}
function wireSpark() {
  const svg = $('#spark'); if (!svg) return;
  drawSpark();
  const n = () => _spark.entries.length;
  svg.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = svg.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const span = _spark.hi - _spark.lo;
    const focus = _spark.lo + frac * span;
    const ns = e.deltaY < 0 ? Math.max(2, Math.round(span * 0.8)) : Math.min(n() - 1, Math.max(span + 1, Math.round(span / 0.8)));
    let lo = Math.round(focus - frac * ns);
    lo = Math.max(0, Math.min(n() - 1 - ns, lo));
    _spark.lo = lo; _spark.hi = lo + ns; drawSpark();
  }, { passive: false });
  let dragX = null, dragLo = 0;
  svg.addEventListener('pointerdown', (e) => { dragX = e.clientX; dragLo = _spark.lo; svg.setPointerCapture(e.pointerId); svg.classList.add('grabbing'); });
  svg.addEventListener('pointermove', (e) => {
    if (dragX == null) return;
    const span = _spark.hi - _spark.lo;
    const rect = svg.getBoundingClientRect();
    const dIdx = Math.round((e.clientX - dragX) / rect.width * span);
    const lo = Math.max(0, Math.min(n() - 1 - span, dragLo - dIdx));
    _spark.lo = lo; _spark.hi = lo + span; drawSpark();
  });
  const end = () => { dragX = null; svg.classList.remove('grabbing'); };
  svg.addEventListener('pointerup', end);
  svg.addEventListener('pointercancel', end);
  svg.addEventListener('dblclick', () => { _spark.lo = 0; _spark.hi = n() - 1; drawSpark(); });

  // hover: snap to the nearest point, show its exact value in a tooltip
  const tip = $('#sparkTip');
  const hideHover = () => {
    const g = $('#sparkGuide'), d = $('#sparkDot');
    if (g) g.setAttribute('opacity', '0');
    if (d) d.setAttribute('opacity', '0');
    if (tip) tip.style.opacity = '0';
  };
  svg.addEventListener('pointermove', (e) => {
    if (dragX != null) return;              // dragging = pan, not hover
    const win = _spark.win; if (!win || !win.length) return;
    const rect = svg.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const idx = Math.round(frac * (win.length - 1));
    const [day, val] = win[idx];
    const gx = _spark.x(idx), gy = _spark.y(val);
    const g = $('#sparkGuide'), d = $('#sparkDot');
    g.setAttribute('x1', gx); g.setAttribute('x2', gx); g.setAttribute('opacity', '1');
    d.setAttribute('cx', gx); d.setAttribute('cy', gy); d.setAttribute('opacity', '1');
    if (tip) {
      tip.innerHTML = `<b>${val}</b> item${val === 1 ? '' : 's'}<span>${day}</span>`;
      const pxX = gx / _spark.w * rect.width, pxY = gy / _spark.h * rect.height;
      // keep the tooltip inside the (clipped) card: clamp x, flip below near the top
      tip.style.left = `${Math.max(46, Math.min(rect.width - 46, pxX))}px`;
      tip.style.top = `${pxY}px`;
      tip.classList.toggle('below', pxY < 52);
      tip.style.opacity = '1';
    }
  });
  svg.addEventListener('pointerleave', hideHover);
}

// ===========================================================================
// SETTINGS
// ===========================================================================
async function renderSettings() {
  const p = $('#page');
  const w = userWeights(); const prefs = userPrefs(); const langSel = userLangs();
  p.innerHTML = `
    <div class="page-head"><div><h1>Settings</h1><p>Your profile, interests, and how Pulse scores relevance.</p></div></div>

    <div class="chart-card glass profile-card">
      <div class="profile-head">
        <div class="avatar">${esc((state.user?.username || '?').trim().slice(0, 2).toUpperCase())}</div>
        <div>
          <h3 class="profile-name">${esc(state.user?.username || 'Your profile')}</h3>
          <p class="hint" style="margin:2px 0 0">Member since ${prettyDate(state.user?.created_at)}</p>
        </div>
      </div>
      <label class="field" style="max-width:440px;margin:0">
        <span>Display name</span>
        <div style="display:flex;gap:10px">
          <input type="text" id="uname" value="${esc(state.user?.username || '')}" />
          <button class="btn primary" data-action="save-name">Save</button>
        </div>
      </label>
    </div>

    <div class="chart-card glass">
      <h3>Relevance weights</h3><p class="hint">These tune your score live. Higher means more influence.</p>
      <div class="weights-wrap">
        <div id="weights">${Object.keys(DEFAULT_WEIGHTS).map((k) => sliderHTML(k, k, w[k])).join('')}</div>
        ${radarSVG(Object.keys(DEFAULT_WEIGHTS).map((k) => ({ label: k[0].toUpperCase() + k.slice(1), value: w[k] })), 'weightsRadar')}
      </div>
    </div>

    <div class="chart-card glass">
      <h3>Source preference</h3><p class="hint">Bias the score toward sources you trust.</p>
      <div id="prefs">${['news', 'video', 'discussion'].map((k) => sliderHTML(k, SOURCES[k].label, prefs[k])).join('')}</div>
      <button class="btn primary" style="margin-top:16px" data-action="save-weights">Save and rescore</button>
    </div>

    <div class="chart-card glass">
      <h3>Languages</h3><p class="hint">Pick up to ${MAX_LANGS}. News and video are fetched only in these. None selected means no language filter.</p>
      <div id="langs" class="tags">${Object.entries(LANGS).map(([code, name]) => {
        const on = langSel.includes(code);
        return `<button type="button" class="tag${on ? ' on' : ''}" data-action="toggle-lang" data-code="${code}" aria-pressed="${on}">${esc(name)}</button>`;
      }).join('')}</div>
      <button class="btn primary" style="margin-top:16px" data-action="save-langs">Save languages</button>
    </div>

    <div class="chart-card glass">
      <h3>Interests</h3><p class="hint">The topics Pulse watches for you. Create, edit and delete.</p>
      <div class="tag-add">
        <input type="text" id="niName" placeholder="Interest name" />
        <input type="text" id="niKw" placeholder="keywords, comma separated" />
        <button class="btn" data-action="add-interest">Add</button>
      </div>
      <div id="ints">${skeletons(1)}</div>
    </div>`;

  const radar = $('#weightsRadar');
  app().querySelectorAll('input[type=range]').forEach((r) => r.oninput = () => {
    r.closest('.slider-row').querySelector('.pct').textContent = `${Math.round(r.value * 100)}%`;
    if (r.closest('#weights')) updateRadar(radar, Array.from(document.querySelectorAll('#weights input[type=range]')).map((s) => +s.value));
  });

  const r = await api('/interests');
  const ints = r.ok ? r.data : [];
  $('#ints').innerHTML = ints.length ? `<div class="tags">${ints.map((it) => `
    <span class="tag">${esc(it.name)}${it.keywords?.length ? ` , <span style="color:var(--muted)">${esc(it.keywords.join(', '))}</span>` : ''}
      , w${it.weight}
      <button data-action="edit-interest" data-id="${it.id}" data-name="${esc(it.name)}" data-kw="${esc((it.keywords || []).join(', '))}" data-weight="${it.weight}" title="edit">${ic('edit')}</button>
      <button data-action="del-interest" data-id="${it.id}" title="delete">${ic('close')}</button>
    </span>`).join('')}</div>`
    : '<p style="color:var(--muted)">No interests yet. Add one above.</p>';
}
function readSliders(rootSel) {
  const out = {};
  app().querySelectorAll(`${rootSel} input[type=range]`).forEach((r) => { out[r.dataset.key] = +r.value; });
  return out;
}

// ===========================================================================
// modal
// ===========================================================================
function modal(inner) {
  closeModal();
  const back = document.createElement('div');
  back.className = 'modal-back'; back.id = 'modalBack';
  back.innerHTML = `<div class="modal glass">${inner}</div>`;
  back.onclick = (e) => { if (e.target === back) closeModal(); };
  document.body.appendChild(back);
}
function closeModal() { const m = $('#modalBack'); if (m) m.remove(); }

async function saveItemFlow(itemId) {
  const r = await api('/collections');
  if (!r.ok) { toast(errMsg(r), 'err'); return; }
  const colls = r.data || [];
  modal(`
    <h3>Save to collection</h3>
    ${colls.length ? `<div class="pick-list">${colls.map((c) => `
      <button class="pick" data-action="do-save" data-coll="${c.id}" data-item="${esc(itemId)}" style="text-align:left;cursor:pointer">
        <span>${esc(c.name)}</span><span style="color:var(--hl)">Save</span></button>`).join('')}</div>`
      : '<p style="color:var(--muted)">No collections yet, create one first.</p>'}
    <div class="row">
      <button class="btn ghost" data-action="quick-collection" data-item="${esc(itemId)}">${ic('plus')} New collection</button>
      <button class="btn" data-action="close-modal">Cancel</button>
    </div>`);
}

// ===========================================================================
// delegated click handler
// ===========================================================================
document.addEventListener('click', async (e) => {
  const t = e.target.closest('[data-action]');
  if (!t) return;
  const a = t.dataset.action;

  if (a === 'open-story') { go(`#/story/${t.dataset.id}`); return; }
  if (a === 'close-modal') { closeModal(); return; }
  if (a === 'scroll-features') { document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' }); return; }

  if (a === 'fb') {
    e.preventDefault();
    const item_id = numericOr(t.dataset.item);
    if (item_id == null) { toast('This item is not in the catalog yet, feedback needs ingested items.', 'err'); return; }
    const r = await api('/feedback', { method: 'POST', body: { item_id, kind: t.dataset.kind } });
    if (r.ok) { t.classList.add(`on-${t.dataset.kind}`); toast(`Saved, ${t.dataset.kind} like this`, 'ok'); }
    else toast(errMsg(r, 'Could not save feedback'), 'err');
    return;
  }

  if (a === 'save') { e.preventDefault(); saveItemFlow(t.dataset.item); return; }
  if (a === 'do-save') {
    const item_id = numericOr(t.dataset.item);
    if (item_id == null) { toast('This item is not in the catalog yet, saving needs ingested items.', 'err'); closeModal(); return; }
    const r = await api(`/collections/${t.dataset.coll}/items/${item_id}`, { method: 'PUT' });
    toast(r.ok ? 'Saved to collection' : errMsg(r, 'Could not save'), r.ok ? 'ok' : 'err');
    closeModal(); return;
  }
  if (a === 'rm-coll-item') {
    const r = await api(`/collections/${t.dataset.coll}/items/${t.dataset.item}`, { method: 'DELETE' });
    if (r.ok) { toast('Removed', 'ok'); viewCollection(t.dataset.coll); } else toast(errMsg(r), 'err');
    return;
  }

  if (a === 'new-collection' || a === 'quick-collection') {
    modal(`
      <h3>New collection</h3>
      <label class="field"><span>Name</span><input type="text" id="cName" autofocus /></label>
      <label class="field"><span>Description, optional</span><input type="text" id="cDesc" /></label>
      <div class="row"><button class="btn ghost" data-action="close-modal">Cancel</button>
      <button class="btn primary" data-action="create-collection" data-item="${esc(t.dataset.item || '')}">Create</button></div>`);
    return;
  }
  if (a === 'create-collection') {
    const name = $('#cName').value.trim();
    if (!name) { toast('Name is required', 'err'); return; }
    const r = await api('/collections', { method: 'POST', body: { name, description: $('#cDesc').value.trim() || null } });
    if (!r.ok) { toast(errMsg(r), 'err'); return; }
    toast('Collection created', 'ok');
    const item = numericOr(t.dataset.item);
    if (item != null) { await api(`/collections/${r.data.id}/items/${item}`, { method: 'PUT' }); toast('Saved to new collection', 'ok'); }
    closeModal();
    if (location.hash.includes('collections')) renderCollections();
    return;
  }
  if (a === 'view-collection') { viewCollection(t.dataset.id); return; }
  if (a === 'edit-collection') {
    modal(`
      <h3>Rename collection</h3>
      <label class="field"><span>Name</span><input type="text" id="cName" value="${esc(t.dataset.name)}" autofocus /></label>
      <label class="field"><span>Description</span><input type="text" id="cDesc" value="${esc(t.dataset.desc)}" /></label>
      <div class="row"><button class="btn ghost" data-action="close-modal">Cancel</button>
      <button class="btn primary" data-action="update-collection" data-id="${t.dataset.id}">Save</button></div>`);
    return;
  }
  if (a === 'update-collection') {
    const name = $('#cName').value.trim();
    if (!name) { toast('Name is required', 'err'); return; }
    const r = await api(`/collections/${t.dataset.id}`, { method: 'PUT', body: { name, description: $('#cDesc').value.trim() || null } });
    toast(r.ok ? 'Saved' : errMsg(r), r.ok ? 'ok' : 'err'); closeModal();
    if (r.ok) renderCollections();
    return;
  }
  if (a === 'del-collection') {
    if (!confirm(`Delete collection ${t.dataset.name}. This cannot be undone.`)) return;
    const r = await api(`/collections/${t.dataset.id}`, { method: 'DELETE' });
    toast(r.ok ? 'Deleted' : errMsg(r), r.ok ? 'ok' : 'err');
    if (r.ok) renderCollections();
    return;
  }

  if (a === 'add-interest') {
    const name = $('#niName').value.trim();
    if (!name) { toast('Interest name required', 'err'); return; }
    const keywords = $('#niKw').value.split(',').map((s) => s.trim()).filter(Boolean);
    const r = await api('/interests', { method: 'POST', body: { name, keywords, weight: 1.0 } });
    toast(r.ok ? 'Interest added' : errMsg(r), r.ok ? 'ok' : 'err');
    if (r.ok) renderSettings();
    return;
  }
  if (a === 'edit-interest') {
    modal(`
      <h3>Edit interest</h3>
      <label class="field"><span>Name</span><input type="text" id="eName" value="${esc(t.dataset.name)}" autofocus /></label>
      <label class="field"><span>Keywords, comma separated</span><input type="text" id="eKw" value="${esc(t.dataset.kw)}" /></label>
      <label class="field"><span>Weight</span><input type="number" id="eW" step="0.1" min="0" value="${esc(t.dataset.weight)}" /></label>
      <div class="row"><button class="btn ghost" data-action="close-modal">Cancel</button>
      <button class="btn primary" data-action="update-interest" data-id="${t.dataset.id}">Save</button></div>`);
    return;
  }
  if (a === 'update-interest') {
    const name = $('#eName').value.trim();
    if (!name) { toast('Name required', 'err'); return; }
    const keywords = $('#eKw').value.split(',').map((s) => s.trim()).filter(Boolean);
    const weight = parseFloat($('#eW').value) || 1.0;
    const r = await api(`/interests/${t.dataset.id}`, { method: 'PUT', body: { name, keywords, weight } });
    toast(r.ok ? 'Saved' : errMsg(r), r.ok ? 'ok' : 'err'); closeModal();
    if (r.ok) renderSettings();
    return;
  }
  if (a === 'del-interest') {
    const r = await api(`/interests/${t.dataset.id}`, { method: 'DELETE' });
    toast(r.ok ? 'Interest removed' : errMsg(r), r.ok ? 'ok' : 'err');
    if (r.ok) renderSettings();
    return;
  }

  if (a === 'save-name') {
    const username = $('#uname').value.trim();
    if (!username) { toast('Username required', 'err'); return; }
    const r = await api('/users/me', { method: 'PATCH', body: { username } });
    if (r.ok) { state.user = r.data.user; localStorage.setItem('pulse_user', JSON.stringify(state.user)); toast('Profile updated', 'ok'); renderShell('settings', renderSettings); }
    else toast(errMsg(r), 'err');
    return;
  }
  if (a === 'save-weights') {
    const weights = readSliders('#weights'); const prefs = readSliders('#prefs');
    const r = await api('/users/me', { method: 'PATCH', body: { weights_json: JSON.stringify(weights), source_prefs_json: JSON.stringify(prefs) } });
    if (r.ok) { state.user = r.data.user; localStorage.setItem('pulse_user', JSON.stringify(state.user)); toast('Saved, your feed will rescore', 'ok'); }
    else toast(errMsg(r), 'err');
    return;
  }

  if (a === 'toggle-lang') {
    const on = t.classList.contains('on');
    if (!on && app().querySelectorAll('#langs .tag.on').length >= MAX_LANGS) {
      toast(`Pick at most ${MAX_LANGS} languages`, 'err'); return;
    }
    t.classList.toggle('on'); t.setAttribute('aria-pressed', String(!on));
    return;
  }
  if (a === 'save-langs') {
    const codes = Array.from(app().querySelectorAll('#langs .tag.on')).map((b) => b.dataset.code);
    const r = await api('/users/me', { method: 'PATCH', body: { languages_json: JSON.stringify(codes) } });
    if (r.ok) { state.user = r.data.user; localStorage.setItem('pulse_user', JSON.stringify(state.user)); toast('Saved, your feed will use these languages', 'ok'); }
    else toast(errMsg(r), 'err');
    return;
  }

  if (a === 'ingest') {
    t.disabled = true; t.textContent = 'Ingesting';
    const q = state.filters.query || '';
    const r = await api(`/stories${q ? `?query=${encodeURIComponent(q)}` : ''}`, { method: 'POST' });
    t.disabled = false; t.innerHTML = `${ic('refresh')} Ingest sources`;
    if (r.ok) { toast(`Ingested ${JSON.stringify(r.data)}`, 'ok'); renderInsights(); }
    else toast(`Ingestion unavailable, code ${r.status}. Charts use your live feed instead.`, 'err');
    return;
  }
});

function numericOr(v) { return /^\d+$/.test(String(v)) ? parseInt(v, 10) : null; }

// ---------------------------------------------------------------------------
// render helpers
// ---------------------------------------------------------------------------
function skeletons(n) { return Array.from({ length: n }, () => '<div class="skeleton"></div>').join(''); }
function stateBox(icon, title, sub, extra = '') {
  return `<div class="empty"><div class="big">${ic(icon)}</div><h3 style="margin:0 0 6px">${esc(title)}</h3>
    <p style="margin:0 0 16px">${esc(sub)}</p>${extra}</div>`;
}

// boot
route();

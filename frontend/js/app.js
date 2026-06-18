/**
 * App entry point. Owns the route table, the auth guard, and mounting the
 * persistent chrome (sidebar + topbar) around authed views.
 */
import { store } from "./store.js";
import { startRouter, currentRoute, navigate } from "./router.js";
import { icon, esc } from "./ui.js";

import { renderLanding } from "./views/landing.js";
import { renderAuth } from "./views/auth.js";
import { renderOnboarding } from "./views/onboarding.js";
import { renderDashboard } from "./views/dashboard.js";
import { renderSearch } from "./views/search.js";
import { renderStory } from "./views/story.js";
import { renderCollections } from "./views/collections.js";
import { renderSettings } from "./views/settings.js";

const app = document.getElementById("app");

// route -> { render, auth, title, nav }
const ROUTES = {
  "/": { render: renderLanding, public: true },
  "/login": { render: (m) => renderAuth(m, "login"), public: true },
  "/register": { render: (m) => renderAuth(m, "register"), public: true },
  "/onboarding": { render: renderOnboarding, title: "Welcome", chrome: false },
  "/dashboard": { render: renderDashboard, title: "Dashboard", nav: "dashboard" },
  "/search": { render: renderSearch, title: "Search", nav: "search" },
  "/collections": { render: renderCollections, title: "Collections", nav: "collections" },
  "/settings": { render: renderSettings, title: "Settings", nav: "settings" },
  "/story": { render: renderStory, title: "Story", nav: "dashboard" },
};

const NAV = [
  { id: "dashboard", label: "Dashboard", icon: "dashboard", path: "/dashboard" },
  { id: "search", label: "Search", icon: "search", path: "/search" },
  { id: "collections", label: "Collections", icon: "bookmark", path: "/collections" },
  { id: "settings", label: "Settings", icon: "settings", path: "/settings" },
];

function chromeHtml(active, title) {
  const u = store.user || {};
  const display = (u.username || "User").split("@")[0]; // friendly name from email
  const initial = display.charAt(0).toUpperCase();
  const navItems = NAV.map(
    (n) => `<a class="nav-item ${n.id === active ? "active" : ""}" href="#${n.path}">
      ${icon(n.icon)}<span>${n.label}</span></a>`
  ).join("");

  return `
  <div class="shell">
    <aside class="sidebar" id="sidebar">
      <div class="brand">
        <div class="logo">P</div>
        <div><div class="name">Pulse</div><div class="tag">your world, ranked</div></div>
      </div>
      <nav class="nav">
        <div class="nav-label">Menu</div>
        ${navItems}
      </nav>
      <div class="sidebar-footer">
        <div class="userchip">
          <div class="avatar">${esc(initial)}</div>
          <div style="min-width:0">
            <div title="${esc(u.username || "")}" style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(display)}</div>
            <button id="logout-btn" class="btn-subtle tiny" style="padding:0">Sign out</button>
          </div>
        </div>
      </div>
    </aside>
    <main class="main">
      <header class="topbar">
        <button class="icon-btn hamburger" id="menu-toggle" aria-label="Menu">${icon("menu")}</button>
        <div class="page-title">${esc(title)}</div>
        <div class="spacer"></div>
        <form class="searchbox" id="quick-search">
          ${icon("search")}
          <input type="search" placeholder="Search topics, stories..." aria-label="Search" />
        </form>
      </header>
      <div class="content view-enter" id="view"></div>
    </main>
  </div>`;
}

function mountChrome(active, title) {
  app.innerHTML = chromeHtml(active, title);

  app.querySelector("#logout-btn").addEventListener("click", () => {
    store.clear();
    navigate("/");
  });

  const sidebar = app.querySelector("#sidebar");
  app.querySelector("#menu-toggle").addEventListener("click", () => sidebar.classList.toggle("open"));

  app.querySelector("#quick-search").addEventListener("submit", (e) => {
    e.preventDefault();
    const q = e.target.querySelector("input").value.trim();
    navigate(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
  });

  return app.querySelector("#view");
}

function handleRoute(route) {
  // strip query string for matching
  const base = "/" + (route.parts[0] || "");
  const match = ROUTES[base] || ROUTES["/"];

  // auth guard
  if (!match.public && !store.isAuthed()) return navigate("/login");
  if (match.public && store.isAuthed() && (base === "/" || base === "/login" || base === "/register"))
    return navigate("/dashboard");

  if (match.public || match.chrome === false) {
    app.innerHTML = `<div class="view-enter" id="view"></div>`;
    match.render(app.querySelector("#view"), route);
  } else {
    const mount = mountChrome(match.nav, match.title);
    match.render(mount, route);
  }
  window.scrollTo(0, 0);
}

window.addEventListener("pulse:unauthorized", () => navigate("/login"));

startRouter(handleRoute);

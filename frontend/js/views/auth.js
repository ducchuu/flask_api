/** Login + registration, sharing one card with a mode toggle. Email-based. */
import { api, ApiError } from "../api.js";
import { store } from "../store.js";
import { navigate } from "../router.js";
import { esc, toast } from "../ui.js";
import { GOOGLE_CLIENT_ID } from "../config.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Return a list of unmet password rules (empty list = valid). */
function passwordIssues(pw) {
  const issues = [];
  if (pw.length < 8) issues.push("at least 8 characters");
  if (!/[A-Za-z]/.test(pw)) issues.push("a letter");
  if (!/[0-9]/.test(pw)) issues.push("a number");
  return issues;
}

/** Send the user to onboarding (no interests yet) or to the dashboard. */
async function continueAfterAuth() {
  const interests = await api.interests().catch(() => []);
  navigate(interests.length ? "/dashboard" : "/onboarding");
}

function loadGsi() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true; s.defer = true;
    s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

function setupGoogle(mount, isLogin) {
  loadGsi().then(() => {
    /* global google */
    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: async (resp) => {
        try {
          const res = await api.googleLogin(resp.credential);
          store.setSession(res.token, res.user, mount.querySelector("#remember")?.checked ?? true);
          toast("Signed in with Google", "success");
          continueAfterAuth();
        } catch (err) {
          toast(err instanceof ApiError ? err.message : "Google sign-in failed", "error");
        }
      },
    });
    google.accounts.id.renderButton(mount.querySelector("#gbtn"), {
      theme: "filled_black", size: "large", shape: "pill",
      text: isLogin ? "signin_with" : "signup_with", width: 320,
    });
  }).catch(() => {
    const el = mount.querySelector("#gbtn");
    if (el) el.innerHTML = `<span class="tiny muted-3">Google sign-in unavailable offline</span>`;
  });
}

export function renderAuth(mount, mode = "login") {
  const isLogin = mode === "login";
  mount.innerHTML = `
  <div class="auth-wrap">
    <div class="auth-card card">
      <div class="brand">
        <div class="logo">P</div>
        <div class="name">Pulse</div>
      </div>
      <h2 class="h-md" style="text-align:center;margin-bottom:4px">
        ${isLogin ? "Welcome back" : "Create your account"}</h2>
      <p class="muted" style="text-align:center;margin-bottom:24px">
        ${isLogin ? "Sign in with your email" : "Start tracking your topics in minutes"}</p>

      <form id="auth-form" novalidate>
        <div class="field">
          <label for="email">Email</label>
          <input class="input" id="email" name="email" type="email" autocomplete="email"
                 placeholder="you@example.com" required />
        </div>
        <div class="field">
          <label for="password">Password</label>
          <input class="input pw-field" id="password" name="password" type="password"
                 autocomplete="${isLogin ? "current-password" : "new-password"}"
                 placeholder="••••••••" required />
          ${isLogin ? "" : `<div class="tiny muted-3" id="pw-hint">Use 8+ characters with a letter and a number.</div>`}
        </div>
        ${isLogin ? "" : `
        <div class="field">
          <label for="confirm">Confirm password</label>
          <input class="input pw-field" id="confirm" name="confirm" type="password"
                 autocomplete="new-password" placeholder="••••••••" required />
        </div>`}
        <div class="row between" style="margin-bottom:4px">
          <label class="show-pw tiny muted"><input type="checkbox" id="show-pw" /> Show password</label>
          <label class="show-pw tiny muted"><input type="checkbox" id="remember" checked /> Remember me</label>
        </div>
        <div class="field-error" id="auth-error"></div>
        <button class="btn btn-primary btn-block" type="submit" id="submit-btn">
          ${isLogin ? "Sign in" : "Create account"}</button>
      </form>

      ${GOOGLE_CLIENT_ID ? `
        <div class="or-divider"><span>or</span></div>
        <div id="gbtn" style="display:flex;justify-content:center"></div>` : ""}

      <p class="switch-line">
        ${isLogin ? "New to Pulse?" : "Already have an account?"}
        <button id="toggle-mode">${isLogin ? "Create one" : "Sign in"}</button>
      </p>
    </div>
  </div>`;

  mount.querySelector("#toggle-mode").addEventListener("click", () =>
    navigate(isLogin ? "/register" : "/login")
  );

  if (GOOGLE_CLIENT_ID) setupGoogle(mount, isLogin);

  mount.querySelector("#show-pw").addEventListener("change", (e) => {
    const type = e.target.checked ? "text" : "password";
    mount.querySelectorAll(".pw-field").forEach((el) => (el.type = type));
  });

  const form = mount.querySelector("#auth-form");
  const errEl = mount.querySelector("#auth-error");
  const btn = mount.querySelector("#submit-btn");

  // live hint colour as the user types a password (register only)
  const pwInput = mount.querySelector("#password");
  const pwHint = mount.querySelector("#pw-hint");
  if (pwHint) {
    pwInput.addEventListener("input", () => {
      const ok = passwordIssues(pwInput.value).length === 0;
      pwHint.style.color = pwInput.value && ok ? "var(--success)" : "var(--text-3)";
    });
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errEl.textContent = "";
    const email = form.email.value.trim();
    const password = form.password.value;

    if (!EMAIL_RE.test(email)) { errEl.textContent = "Enter a valid email address."; return; }
    if (!password) { errEl.textContent = "Password is required."; return; }

    if (!isLogin) {
      const issues = passwordIssues(password);
      if (issues.length) { errEl.textContent = "Password needs " + issues.join(", ") + "."; return; }
      if (password !== form.confirm.value) { errEl.textContent = "Passwords don't match."; return; }
    }

    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> ${isLogin ? "Signing in" : "Creating"}...`;
    try {
      const res = isLogin
        ? await api.login(email, password)
        : await api.register(email, password);
      store.setSession(res.token, res.user, mount.querySelector("#remember").checked);
      toast(isLogin ? "Signed in" : "Account created", "success");
      continueAfterAuth();
    } catch (err) {
      errEl.textContent = err instanceof ApiError ? err.message : "Something went wrong.";
      btn.disabled = false;
      btn.textContent = isLogin ? "Sign in" : "Create account";
    }
  });
}

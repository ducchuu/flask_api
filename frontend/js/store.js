/**
 * Tiny app state.
 *
 * "Remember me" decides where the session lives: localStorage (survives a
 * browser restart) when checked, or sessionStorage (cleared when the tab
 * closes) when not. The last feed is kept in memory so opening a story detail
 * doesn't need a refetch.
 */
const TOKEN_KEY = "pulse.token";
const USER_KEY = "pulse.user";

/** Read an existing session from whichever storage holds it. */
function readSession() {
  for (const s of [localStorage, sessionStorage]) {
    const token = s.getItem(TOKEN_KEY);
    if (token) {
      return {
        token,
        user: JSON.parse(s.getItem(USER_KEY) || "null"),
        persistent: s === localStorage,
      };
    }
  }
  return { token: null, user: null, persistent: true };
}

const initial = readSession();

export const store = {
  token: initial.token,
  user: initial.user,
  persistent: initial.persistent, // which storage the session lives in

  feed: [],
  storiesById: new Map(),

  /** Persist a session. remember=true -> localStorage, false -> sessionStorage. */
  setSession(token, user, remember = true) {
    this.token = token;
    this.user = user;
    this.persistent = remember;
    const target = remember ? localStorage : sessionStorage;
    const other = remember ? sessionStorage : localStorage;
    target.setItem(TOKEN_KEY, token);
    target.setItem(USER_KEY, JSON.stringify(user));
    other.removeItem(TOKEN_KEY);
    other.removeItem(USER_KEY);
  },

  setUser(user) {
    this.user = user;
    const target = this.persistent ? localStorage : sessionStorage;
    target.setItem(USER_KEY, JSON.stringify(user));
  },

  cacheFeed(stories) {
    this.feed = stories;
    this.storiesById = new Map(stories.map((s) => [String(s.id), s]));
  },

  isAuthed() {
    return Boolean(this.token);
  },

  clear() {
    this.token = null;
    this.user = null;
    this.feed = [];
    this.storiesById = new Map();
    for (const s of [localStorage, sessionStorage]) {
      s.removeItem(TOKEN_KEY);
      s.removeItem(USER_KEY);
    }
  },
};

/**
 * Minimal hash router. Routes look like "#/dashboard" or "#/story/story-3".
 * Views register a render function; the router calls it with any path parts.
 */
let onChange = () => {};

/** Parse the current hash into a path and its slash-separated parts. */
export function currentRoute() {
  const raw = location.hash.replace(/^#/, "") || "/";
  const [pathPart, queryPart = ""] = raw.split("?");
  const parts = pathPart.split("/").filter(Boolean);
  return { path: "/" + parts.join("/"), parts, query: queryPart };
}

export function navigate(path) {
  if (location.hash === "#" + path) onChange(currentRoute());
  else location.hash = path;
}

export function startRouter(handler) {
  onChange = handler;
  window.addEventListener("hashchange", () => handler(currentRoute()));
  handler(currentRoute());
}

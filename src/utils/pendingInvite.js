const STORAGE_KEY = "pending_invite_token";
const TTL_IN_MS = 24 * 60 * 60 * 1000;

function getStoredPath(from) {
  if (!from) {
    return "";
  }

  if (typeof from === "string") {
    return from;
  }

  return `${from.pathname || ""}${from.search || ""}${from.hash || ""}`;
}

export function getPendingInviteToken() {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    if (parsed?.token) {
      if (parsed.ts && Date.now() - parsed.ts >= TTL_IN_MS) {
        window.localStorage.removeItem(STORAGE_KEY);
        return null;
      }

      return parsed.token;
    }
  } catch {
    return raw;
  }

  window.localStorage.removeItem(STORAGE_KEY);
  return null;
}

export function getPostAuthPath(from) {
  const fromPath = getStoredPath(from);
  if (fromPath && !["/login", "/registro"].includes(fromPath)) {
    return fromPath;
  }

  const pendingInviteToken = getPendingInviteToken();
  if (pendingInviteToken) {
    return `/join/${pendingInviteToken}`;
  }

  return "/inicio";
}

export function getAbsoluteAppUrl(path) {
  if (typeof window === "undefined") {
    return path;
  }

  return `${window.location.origin}${path}`;
}

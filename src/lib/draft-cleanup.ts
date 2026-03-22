const DRAFT_PREFIXES = [
  "tech-wo-",
  "pe-notes-",
  "pe-profile-",
  "client-profile-",
  "admin-partner-",
];

const MAX_DRAFT_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function cleanStaleDrafts() {
  try {
    const now = Date.now();
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (!key) continue;

      const isDraft = DRAFT_PREFIXES.some(p => key.startsWith(p));
      if (!isDraft) continue;

      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (parsed._savedAt && now - parsed._savedAt > MAX_DRAFT_AGE_MS) {
          localStorage.removeItem(key);
        }
      } catch {
        localStorage.removeItem(key);
      }
    }
  } catch { /* localStorage unavailable */ }
}

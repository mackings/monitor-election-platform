/** `crypto.randomUUID` only exists in secure contexts (HTTPS, or the
 * browser's special-cased `localhost`) -- everywhere this is used, the id
 * is purely local (a React list key, an IndexedDB key, a placeholder id
 * resolved to a real server id later), never anything security-sensitive,
 * so a non-cryptographic fallback is safe. Without it, loading the app
 * over plain HTTP (e.g. a LAN IP during testing, not just a hypothetical)
 * hard-crashes the first component that generates an id. */
export function uuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

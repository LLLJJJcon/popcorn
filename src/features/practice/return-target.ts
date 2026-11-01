const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const saved = new RegExp(`^/saved/${uuid}(?:#saved-item-${uuid})?$`, "i");
const vault = new RegExp(`^/vault/${uuid}$`, "i");
export type PracticeReturnTarget = { href: string; label: "Saved" | "Today's practice" | "Vault" | "Home" };
export function resolvePracticeReturnTarget(value: unknown): PracticeReturnTarget {
  const fallback: PracticeReturnTarget = { href: "/saved", label: "Saved" };
  if (typeof value !== "string" || /[\\\s\u0000-\u001f]/u.test(value) || /%(?:0[ad]|5c)/iu.test(value)) return fallback;
  if (saved.test(value) || value === "/saved") return { href: value, label: "Saved" };
  if (vault.test(value)) return { href: value, label: "Vault" };
  if (value === "/home") return { href: value, label: "Home" };
  if (/^\/practice(?:\?[^#]*)?(?:#[a-z0-9-]+)?$/iu.test(value)) return { href: value, label: "Today's practice" };
  return fallback;
}
export function practiceTaskHref(taskId: string, returnTo: string): string { return `/practice/${encodeURIComponent(taskId)}?returnTo=${encodeURIComponent(resolvePracticeReturnTarget(returnTo).href)}`; }

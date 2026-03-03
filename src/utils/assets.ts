const SCHEME_RE = /^[a-zA-Z][a-zA-Z\d+\-.]*:/;

export function resolveAssetUrl(input?: string): string | undefined {
  if (!input) return undefined;
  const value = input.trim();
  if (!value) return undefined;

  if (value.startsWith("data:") || SCHEME_RE.test(value)) {
    return value;
  }

  if (typeof window === "undefined") {
    return value;
  }

  const base = (import.meta.env.BASE_URL || "/").replace(/\/+$/, "");
  if (value.startsWith("/")) {
    return `${window.location.origin}${base}${value}`;
  }
  return `${window.location.origin}${base}/${value.replace(/^\/+/, "")}`;
}

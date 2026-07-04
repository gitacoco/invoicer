export function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

export function sendMethodNotAllowed(res, allowed) {
  res.setHeader("Allow", allowed.join(", "));
  sendJson(res, 405, { ok: false, error: "Method not allowed." });
}

export async function readRawBody(req) {
  if (typeof req.body === "string") return req.body;
  if (req.body && typeof req.body === "object") return JSON.stringify(req.body);

  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) =>
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    );
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

export async function readJsonBody(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
    return req.body;
  }
  const raw = await readRawBody(req);
  if (!raw.trim()) return {};
  return JSON.parse(raw);
}

export function requestUrl(req) {
  return new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
}

export function queryValue(value) {
  if (Array.isArray(value)) return value.join("/");
  return typeof value === "string" ? value : "";
}

export function queryPathSegments(req) {
  const path = queryValue(req.query?.path);
  if (!path) return [];
  return path
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) => decodeURIComponent(segment));
}

export function handleError(res, error, statusCode = 500) {
  sendJson(res, statusCode, {
    ok: false,
    error: error instanceof Error ? error.message : String(error),
  });
}

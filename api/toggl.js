import { handleError, queryValue } from "./_lib/http.js";

const TOGGL_ORIGIN = "https://api.track.toggl.com";

function forwardHeaders(req) {
  const headers = {};
  for (const [key, value] of Object.entries(req.headers)) {
    const lower = key.toLowerCase();
    if (
      lower === "host" ||
      lower === "connection" ||
      lower === "content-length" ||
      lower === "accept-encoding"
    ) {
      continue;
    }
    if (Array.isArray(value)) {
      headers[key] = value.join(", ");
    } else if (typeof value === "string") {
      headers[key] = value;
    }
  }
  return headers;
}

async function readBodyForProxy(req) {
  if (req.method === "GET" || req.method === "HEAD") return undefined;
  if (typeof req.body === "string" || Buffer.isBuffer(req.body)) return req.body;
  if (req.body && typeof req.body === "object") return JSON.stringify(req.body);

  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) =>
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    );
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  try {
    const path = queryValue(req.query?.path).replace(/^\/+/, "");
    if (!path) {
      res.statusCode = 400;
      res.end("Missing Toggl API path.");
      return;
    }

    const incomingUrl = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    incomingUrl.searchParams.delete("path");
    const upstreamUrl = `${TOGGL_ORIGIN}/${path}${incomingUrl.search}`;
    const upstream = await fetch(upstreamUrl, {
      method: req.method,
      headers: forwardHeaders(req),
      body: await readBodyForProxy(req),
    });

    res.statusCode = upstream.status;
    upstream.headers.forEach((value, key) => {
      const lower = key.toLowerCase();
      if (
        lower === "content-encoding" ||
        lower === "content-length" ||
        lower === "transfer-encoding"
      ) {
        return;
      }
      res.setHeader(key, value);
    });
    const body = Buffer.from(await upstream.arrayBuffer());
    res.end(body);
  } catch (error) {
    handleError(res, error, 502);
  }
}
